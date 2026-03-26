import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type DisplayParticipant = { id: string; displayName: string | null; isAnonymous: boolean };

export type DisplayItem =
  | {
      kind: 'question';
      id: string;
      originalText: string;
      voteCount: number;
      createdAt: string;
      participant: DisplayParticipant;
    }
  | {
      kind: 'cluster';
      clusterId: string;
      unifiedText: string;
      voteCount: number;
      createdAt: string;
      sources?: Array<{ id: string; originalText: string; participant: DisplayParticipant }>;
    };

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  async create(data: { poolId: string; participantId: string; originalText: string; moderationStatus?: string; moderationReason?: string }) {
    return this.prisma.question.create({ data, include: { participant: { select: { id: true, displayName: true, isAnonymous: true } } } });
  }

  async findByPool(poolId: string, onlyApproved = true) {
    const where: any = { poolId };
    if (onlyApproved) where.moderationStatus = 'approved';
    return this.prisma.question.findMany({
      where,
      include: {
        participant: { select: { id: true, displayName: true, isAnonymous: true } },
        cluster: true,
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findFlaggedByPool(poolId: string) {
    return this.prisma.question.findMany({
      where: { poolId, moderationStatus: { in: ['flagged_standard', 'flagged_custom'] } },
      include: { participant: { select: { id: true, displayName: true, isAnonymous: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateModeration(id: string, status: string) {
    await this.prisma.question.update({ where: { id }, data: { moderationStatus: status } });
    return this.prisma.question.findUnique({
      where: { id },
      include: {
        participant: { select: { id: true, displayName: true, isAnonymous: true } },
        cluster: true,
        _count: { select: { votes: true } },
      },
    });
  }

  async buildDisplayItems(poolId: string, includeSources: boolean): Promise<DisplayItem[]> {
    const clusters = await this.prisma.questionCluster.findMany({
      where: { poolId },
      include: {
        questions: {
          where: { moderationStatus: 'approved' },
          include: {
            participant: { select: { id: true, displayName: true, isAnonymous: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const standalone = await this.prisma.question.findMany({
      where: {
        poolId,
        moderationStatus: 'approved',
        clusterId: null,
        status: 'active',
      },
      include: {
        participant: { select: { id: true, displayName: true, isAnonymous: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: DisplayItem[] = [];

    for (const c of clusters) {
      if (c.questions.length === 0) continue;
      const base = {
        kind: 'cluster' as const,
        clusterId: c.id,
        unifiedText: c.unifiedText,
        voteCount: c._count.votes,
        createdAt: c.createdAt.toISOString(),
      };
      if (includeSources) {
        items.push({
          ...base,
          sources: c.questions.map((q) => ({
            id: q.id,
            originalText: q.originalText,
            participant: q.participant,
          })),
        });
      } else {
        items.push(base);
      }
    }

    for (const q of standalone) {
      items.push({
        kind: 'question',
        id: q.id,
        originalText: q.originalText,
        voteCount: q._count.votes,
        createdAt: q.createdAt.toISOString(),
        participant: q.participant,
      });
    }

    return items;
  }

  standaloneQuestionToDisplayItem(q: {
    id: string;
    originalText: string;
    createdAt: Date;
    participant: DisplayParticipant;
    _count: { votes: number };
  }): DisplayItem {
    return {
      kind: 'question',
      id: q.id,
      originalText: q.originalText,
      voteCount: q._count.votes,
      createdAt: q.createdAt.toISOString(),
      participant: q.participant,
    };
  }

  async enrichQuestionForEmit(id: string) {
    return this.prisma.question.findUnique({
      where: { id },
      include: {
        participant: { select: { id: true, displayName: true, isAnonymous: true } },
        cluster: true,
        _count: { select: { votes: true } },
      },
    });
  }

  /**
   * Resolves vote target: merged questions vote on their cluster.
   */
  async resolveVoteTarget(
    questionId?: string,
    clusterId?: string,
  ): Promise<{ kind: 'question'; id: string } | { kind: 'cluster'; id: string } | null> {
    if (clusterId) {
      const c = await this.prisma.questionCluster.findUnique({ where: { id: clusterId } });
      return c ? { kind: 'cluster', id: clusterId } : null;
    }
    if (!questionId) return null;
    const q = await this.prisma.question.findUnique({
      where: { id: questionId },
      select: { clusterId: true },
    });
    if (!q) return null;
    if (q.clusterId) return { kind: 'cluster', id: q.clusterId };
    return { kind: 'question', id: questionId };
  }

  async vote(participantId: string, questionId: string) {
    const existing = await this.prisma.questionVote.findUnique({
      where: { participantId_questionId: { participantId, questionId } },
    });
    if (existing) {
      await this.prisma.questionVote.delete({ where: { id: existing.id } });
      return { voted: false };
    }
    await this.prisma.questionVote.create({ data: { participantId, questionId } });
    return { voted: true };
  }

  async voteCluster(participantId: string, clusterId: string) {
    const existing = await this.prisma.questionVote.findUnique({
      where: { participantId_clusterId: { participantId, clusterId } },
    });
    if (existing) {
      await this.prisma.questionVote.delete({ where: { id: existing.id } });
      return { voted: false };
    }
    await this.prisma.questionVote.create({ data: { participantId, clusterId } });
    return { voted: true };
  }

  async voteOnTarget(
    participantId: string,
    questionId?: string,
    clusterId?: string,
  ): Promise<{
    targetKind: 'question' | 'cluster';
    targetId: string;
    voted: boolean;
    voteCount: number;
  } | null> {
    const target = await this.resolveVoteTarget(questionId, clusterId);
    if (!target) return null;
    if (target.kind === 'cluster') {
      const r = await this.voteCluster(participantId, target.id);
      const voteCount = await this.getClusterVoteCount(target.id);
      return { targetKind: 'cluster', targetId: target.id, voted: r.voted, voteCount };
    }
    const r = await this.vote(participantId, target.id);
    const voteCount = await this.getVoteCount(target.id);
    return { targetKind: 'question', targetId: target.id, voted: r.voted, voteCount };
  }

  async getVoteCount(questionId: string) {
    return this.prisma.questionVote.count({ where: { questionId } });
  }

  async getClusterVoteCount(clusterId: string) {
    return this.prisma.questionVote.count({ where: { clusterId } });
  }
}
