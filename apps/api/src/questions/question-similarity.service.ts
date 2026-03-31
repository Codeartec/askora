import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

export type SimilarityHintScope = 'live' | 'resolved';

export interface SimilarityHint {
  scope: SimilarityHintScope;
  kind: 'cluster' | 'question';
  id: string;
  /** Empty when match is resolved but host hides resolved list from participants. */
  previewText: string;
}

const MAX_CANDIDATES = 40;

@Injectable()
export class QuestionSimilarityService {
  private readonly logger = new Logger(QuestionSimilarityService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
  ) {}

  /**
   * Compares the new question to live and resolved display items. Fail-open: returns null on error.
   */
  async findHintForNewQuestion(
    poolId: string,
    newQuestionText: string,
    excludeQuestionId: string,
    showResolvedPreview: boolean,
  ): Promise<SimilarityHint | null> {
    const liveClusters = await this.prisma.questionCluster.findMany({
      where: { poolId, status: 'active' },
      select: { id: true, unifiedText: true },
    });

    const liveStandalone = await this.prisma.question.findMany({
      where: {
        poolId,
        moderationStatus: 'approved',
        status: 'active',
        clusterId: null,
        id: { not: excludeQuestionId },
      },
      select: { id: true, originalText: true },
    });

    const resolvedClusters = await this.prisma.questionCluster.findMany({
      where: { poolId, status: 'answered' },
      select: { id: true, unifiedText: true },
    });

    const resolvedStandalone = await this.prisma.question.findMany({
      where: {
        poolId,
        moderationStatus: 'approved',
        status: 'answered',
        clusterId: null,
      },
      select: { id: true, originalText: true },
    });

    type Cand = { scope: SimilarityHintScope; kind: 'cluster' | 'question'; id: string; text: string };
    const candidates: Cand[] = [];

    for (const c of liveClusters) {
      candidates.push({ scope: 'live', kind: 'cluster', id: c.id, text: c.unifiedText });
    }
    for (const q of liveStandalone) {
      candidates.push({ scope: 'live', kind: 'question', id: q.id, text: q.originalText });
    }
    for (const c of resolvedClusters) {
      candidates.push({ scope: 'resolved', kind: 'cluster', id: c.id, text: c.unifiedText });
    }
    for (const q of resolvedStandalone) {
      candidates.push({ scope: 'resolved', kind: 'question', id: q.id, text: q.originalText });
    }

    if (candidates.length === 0) return null;

    const trimmed = candidates.slice(0, MAX_CANDIDATES);

    const list = trimmed
      .map((c, i) => `${i + 1}. [${c.scope}.${c.kind}] id=${c.id} — "${c.text}"`)
      .join('\n');

    const systemPrompt = `You decide if a new audience question is essentially asking the same thing as one of the listed items. Only set match true for strong semantic overlap. Respond ONLY with valid JSON.`;

    const userPrompt = `New question:
"${newQuestionText}"

Candidates (scope live = still in queue; resolved = marked answered by host):
${list}

Respond with JSON only. Either {"match": false} or {"match": true, "candidate_index": N} where N is the 1-based index in the list above.`;

    try {
      const result = await this.llm.chatCompletion(systemPrompt, userPrompt);
      if (!result.ok) return null;
      const parsed = JSON.parse(result.content);
      if (!parsed.match || typeof parsed.candidate_index !== 'number') return null;
      const idx = parsed.candidate_index - 1;
      if (idx < 0 || idx >= trimmed.length) return null;
      const cand = trimmed[idx];
      let previewText = cand.text;
      if (cand.scope === 'resolved' && !showResolvedPreview) {
        previewText = '';
      }
      return {
        scope: cand.scope,
        kind: cand.kind,
        id: cand.id,
        previewText,
      };
    } catch (e: any) {
      this.logger.warn(`Similarity check failed: ${e?.message}`);
      return null;
    }
  }
}
