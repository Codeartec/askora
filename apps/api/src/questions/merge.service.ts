import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

export interface MergeResult {
  clusters: Array<{ id: string; unifiedText: string; questionIds: string[] }>;
}

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

    let clusters: MergeResult['clusters'] = [];

    if (questions.length >= 2) {
      const llmClusters = await this.tryLlmMerge(questions);
      if (llmClusters.length > 0) {
        clusters = await this.prisma.$transaction(async (tx) => {
          const created: MergeResult['clusters'] = [];
          for (const spec of llmClusters) {
            const row = await tx.questionCluster.create({
              data: { poolId, unifiedText: spec.unifiedText },
            });
            await tx.question.updateMany({
              where: { id: { in: spec.questionIds } },
              data: { clusterId: row.id, status: 'merged' },
            });
            await this.migrateVotesToCluster(tx, row.id, spec.questionIds);
            created.push({
              id: row.id,
              unifiedText: row.unifiedText,
              questionIds: spec.questionIds,
            });
          }
          return created;
        });
        this.logger.log(`Merged ${clusters.length} cluster(s) for pool ${poolId}`);
      } else {
        this.logger.log(`LLM merge produced no valid clusters for pool ${poolId}`);
      }
    } else {
      this.logger.log(`Merge pass skipped (insufficient questions) for pool ${poolId}`);
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
  ): Promise<Array<{ unifiedText: string; questionIds: string[] }>> {
    const systemPrompt = `You are an assistant that analyzes audience questions and groups those with the same meaning or intent. For each group, generate a clear, well-written unified question in the original language. Only group questions that are truly asking the same thing.`;

    const questionsList = questions
      .map((q, i) => `${i + 1}. [id: ${q.id}] "${q.originalText}"`)
      .join('\n');

    const userPrompt = `Analyze these questions and group similar ones. Respond ONLY with valid JSON.

Questions:
${questionsList}

Response format:
{
  "clusters": [
    {
      "unified_text": "The unified question text",
      "question_ids": ["id1", "id2"]
    }
  ],
  "unclustered": ["id3"]
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

      const out: Array<{ unifiedText: string; questionIds: string[] }> = [];

      for (const cluster of parsed.clusters) {
        if (!cluster.question_ids || cluster.question_ids.length < 2) continue;

        const validIds = (cluster.question_ids as string[]).filter((qid: string) =>
          questions.some((q) => q.id === qid),
        );

        if (validIds.length < 2) continue;

        const text =
          typeof cluster.unified_text === 'string' && cluster.unified_text.trim()
            ? cluster.unified_text.trim()
            : 'Merged question';

        out.push({ unifiedText: text, questionIds: validIds });
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

    const seen = new Set<string>();
    const rows: { participantId: string; clusterId: string }[] = [];
    for (const v of votes) {
      if (seen.has(v.participantId)) continue;
      seen.add(v.participantId);
      rows.push({ participantId: v.participantId, clusterId });
    }

    await tx.questionVote.deleteMany({ where: { questionId: { in: questionIds } } });

    if (rows.length > 0) {
      await tx.questionVote.createMany({ data: rows });
    }
  }

}
