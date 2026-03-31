import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

export interface MergeResult {
  clusters: Array<{ id: string; unifiedText: string; questionIds: string[] }>;
}

type LlmMergeSpec =
  | { type: 'new'; unifiedText: string; questionIds: string[] }
  | { type: 'attach'; clusterId: string; unifiedText?: string; questionIds: string[] };

@Injectable()
export class MergeService {
  private readonly logger = new Logger(MergeService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  /**
   * Runs a merge review pass: may call LLM, create clusters, migrate votes.
   * Always clears questionsSinceMerge and sets lastQuestionMergeAt (completed review).
   */
  async runMergePass(poolId: string): Promise<MergeResult> {
    const questions = await this.prisma.question.findMany({
      where: {
        poolId,
        moderationStatus: 'approved',
        status: 'active',
        clusterId: null,
      },
      select: { id: true, originalText: true },
    });

    const existingClusters = await this.prisma.questionCluster.findMany({
      where: { poolId, status: 'active' },
      select: { id: true, unifiedText: true },
    });

    let clusters: MergeResult['clusters'] = [];

    const canMerge =
      questions.length >= 2 ||
      (questions.length >= 1 && existingClusters.length >= 1);

    if (canMerge) {
      const llmSpecs = await this.tryLlmMerge(questions, existingClusters);
      if (llmSpecs.length > 0) {
        clusters = await this.prisma.$transaction(async (tx) => {
          const created: MergeResult['clusters'] = [];
          const usedQuestionIds = new Set<string>();

          for (const spec of llmSpecs) {
            if (spec.type === 'new') {
              const ids = spec.questionIds.filter((id) => !usedQuestionIds.has(id));
              if (ids.length < 2) continue;

              const row = await tx.questionCluster.create({
                data: { poolId, unifiedText: spec.unifiedText },
              });
              await tx.question.updateMany({
                where: { id: { in: ids } },
                data: { clusterId: row.id, status: 'merged' },
              });
              await this.migrateVotesToCluster(tx, row.id, ids);
              for (const id of ids) usedQuestionIds.add(id);
              created.push({
                id: row.id,
                unifiedText: row.unifiedText,
                questionIds: ids,
              });
            } else {
              const clusterExists = existingClusters.some((c) => c.id === spec.clusterId);
              if (!clusterExists) continue;

              const ids = spec.questionIds.filter((id) => !usedQuestionIds.has(id));
              if (ids.length < 1) continue;

              let unifiedText = spec.unifiedText?.trim();
              if (unifiedText) {
                await tx.questionCluster.update({
                  where: { id: spec.clusterId },
                  data: { unifiedText },
                });
              } else {
                const cur = await tx.questionCluster.findUnique({
                  where: { id: spec.clusterId },
                  select: { unifiedText: true },
                });
                unifiedText = cur?.unifiedText ?? '';
              }

              await tx.question.updateMany({
                where: { id: { in: ids } },
                data: { clusterId: spec.clusterId, status: 'merged' },
              });
              await this.migrateVotesToCluster(tx, spec.clusterId, ids);
              for (const id of ids) usedQuestionIds.add(id);
              created.push({
                id: spec.clusterId,
                unifiedText: unifiedText || 'Merged question',
                questionIds: ids,
              });
            }
          }

          return created;
        });
        this.logger.log(`Merged ${clusters.length} cluster op(s) for pool ${poolId}`);
      } else {
        this.logger.log(`LLM merge produced no valid clusters for pool ${poolId}`);
      }
    } else {
      this.logger.log(`Merge pass skipped (insufficient items) for pool ${poolId}`);
    }

    await this.prisma.pool.update({
      where: { id: poolId },
      data: {
        questionsSinceMerge: 0,
        lastQuestionMergeAt: new Date(),
      },
    });

    return { clusters };
  }

  private async tryLlmMerge(
    questions: { id: string; originalText: string }[],
    existingClusters: { id: string; unifiedText: string }[],
  ): Promise<LlmMergeSpec[]> {
    const systemPrompt = `You are an assistant that analyzes audience questions and groups those with the same meaning or intent. Items may be standalone questions or existing merged groups (clusters) with a unified question text. For each new group of duplicates, output a clear unified question in the original language. You may attach standalone questions to an existing cluster when they ask the same thing as that cluster's unified question. Only group items that truly match.`;

    const lines: string[] = [];
    let n = 1;
    for (const q of questions) {
      lines.push(`${n}. [question] id=${q.id} — "${q.originalText}"`);
      n += 1;
    }
    for (const c of existingClusters) {
      lines.push(`${n}. [existing_cluster] cluster_id=${c.id} — unified: "${c.unifiedText}"`);
      n += 1;
    }

    const userPrompt = `Analyze these items and group duplicates. Respond ONLY with valid JSON.

Items:
${lines.join('\n')}

Rules:
- To form a NEW merged group from standalone questions only: use "cluster_id": null and at least two "question_ids" from the [question] lines.
- To ATTACH standalone question(s) to an EXISTING cluster: set "cluster_id" to that cluster's id and list those question ids in "question_ids" (one or more). Optionally set "unified_text" to an improved wording for the cluster.
- Do not merge two existing_cluster items together in this pass.
- Each question id may appear at most once across all output clusters.

Response format:
{
  "clusters": [
    {
      "unified_text": "The unified question text",
      "question_ids": ["uuid1", "uuid2"],
      "cluster_id": null
    },
    {
      "unified_text": "Optional updated unified text",
      "question_ids": ["uuid3"],
      "cluster_id": "existing-cluster-uuid"
    }
  ]
}`;

    try {
      const raw = await this.llm.chatCompletion(systemPrompt, userPrompt);
      if (!raw) {
        this.logger.warn('LLM returned null for merge');
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!parsed.clusters || !Array.isArray(parsed.clusters)) {
        this.logger.warn('Invalid merge response format');
        return [];
      }

      const questionIdSet = new Set(questions.map((q) => q.id));
      const clusterIdSet = new Set(existingClusters.map((c) => c.id));
      const out: LlmMergeSpec[] = [];
      const seenQuestions = new Set<string>();

      for (const cluster of parsed.clusters) {
        const rawIds = Array.isArray(cluster.question_ids) ? cluster.question_ids : [];
        const clusterId =
          cluster.cluster_id === null || cluster.cluster_id === undefined
            ? null
            : String(cluster.cluster_id);

        const validQids = (rawIds as string[]).filter(
          (qid) => questionIdSet.has(qid) && !seenQuestions.has(qid),
        );

        if (clusterId === null) {
          if (validQids.length < 2) continue;
          const text =
            typeof cluster.unified_text === 'string' && cluster.unified_text.trim()
              ? cluster.unified_text.trim()
              : 'Merged question';
          for (const id of validQids) seenQuestions.add(id);
          out.push({ type: 'new', unifiedText: text, questionIds: validQids });
        } else {
          if (!clusterIdSet.has(clusterId)) continue;
          if (validQids.length < 1) continue;
          const ut =
            typeof cluster.unified_text === 'string' && cluster.unified_text.trim()
              ? cluster.unified_text.trim()
              : undefined;
          for (const id of validQids) seenQuestions.add(id);
          out.push({
            type: 'attach',
            clusterId,
            unifiedText: ut,
            questionIds: validQids,
          });
        }
      }

      return out;
    } catch (err: any) {
      this.logger.error(`Merge failed: ${err?.message}`);
      return [];
    }
  }

  private async migrateVotesToCluster(
    tx: Prisma.TransactionClient,
    clusterId: string,
    questionIds: string[],
  ) {
    const votes = await tx.questionVote.findMany({
      where: { questionId: { in: questionIds } },
      orderBy: { createdAt: 'asc' },
    });

    const existingClusterVotes = await tx.questionVote.findMany({
      where: { clusterId },
      select: { participantId: true },
    });
    const alreadyOnCluster = new Set(existingClusterVotes.map((v) => v.participantId));

    const seen = new Set<string>();
    const rows: { participantId: string; clusterId: string }[] = [];
    for (const v of votes) {
      if (seen.has(v.participantId)) continue;
      if (alreadyOnCluster.has(v.participantId)) continue;
      seen.add(v.participantId);
      rows.push({ participantId: v.participantId, clusterId });
    }

    await tx.questionVote.deleteMany({ where: { questionId: { in: questionIds } } });

    if (rows.length > 0) {
      await tx.questionVote.createMany({ data: rows });
    }
  }
}
