import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PollResultsFull = NonNullable<Awaited<ReturnType<PollsService['getResults']>>>;

export type PollPublicResults = {
  id: string;
  questionText: string;
  type: string;
  showResultsToParticipants: boolean;
  totalResponses: number;
  options: Array<{ id: string; text: string; position: number; responseCount: number }>;
};

export type PollCompletedPublic = PollPublicResults & { closedAt: string };

@Injectable()
export class PollsService {
  constructor(private prisma: PrismaService) {}

  async create(
    poolId: string,
    data: {
      questionText: string;
      type: string;
      options?: string[];
      showResultsToParticipants?: boolean;
    },
  ) {
    const poll = await this.prisma.poll.create({
      data: {
        poolId,
        questionText: data.questionText,
        type: data.type,
        status: 'draft',
        showResultsToParticipants: data.showResultsToParticipants ?? false,
      },
    });

    if (data.options && data.options.length > 0) {
      await this.prisma.pollOption.createMany({
        data: data.options.map((text, i) => ({
          pollId: poll.id,
          text,
          position: i,
        })),
      });
    }

    return this.findById(poll.id);
  }

  async findById(id: string) {
    return this.prisma.poll.findUnique({
      where: { id },
      include: {
        options: { orderBy: { position: 'asc' } },
        _count: { select: { responses: true } },
      },
    });
  }

  async findByPool(poolId: string) {
    return this.prisma.poll.findMany({
      where: { poolId },
      include: {
        options: { orderBy: { position: 'asc' } },
        _count: { select: { responses: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveByPoolId(poolId: string) {
    return this.prisma.poll.findFirst({
      where: { poolId, status: 'active' },
      orderBy: [{ sentAt: 'desc' }, { createdAt: 'desc' }],
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }

  async findDraftsByPoolId(poolId: string) {
    return this.prisma.poll.findMany({
      where: { poolId, status: 'draft' },
      orderBy: { createdAt: 'desc' },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }

  async findClosedByPoolId(poolId: string, take = 50): Promise<PollCompletedPublic[]> {
    const limit = Math.min(Math.max(1, take), 100);
    const rows = await this.prisma.poll.findMany({
      where: { poolId, status: 'closed' },
      orderBy: { closedAt: 'desc' },
      take: limit,
      include: {
        options: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { responses: true } } },
        },
        _count: { select: { responses: true } },
      },
    });
    return rows.map((full) => ({
      ...this.toPublicResults(full as PollResultsFull),
      closedAt: (full.closedAt ?? full.createdAt).toISOString(),
    }));
  }

  async deleteDraft(pollId: string, poolId: string): Promise<boolean> {
    const row = await this.prisma.poll.findFirst({
      where: { id: pollId, poolId, status: 'draft' },
    });
    if (!row) return false;

    await this.prisma.$transaction([
      this.prisma.pollResponse.deleteMany({ where: { pollId } }),
      this.prisma.pollOption.deleteMany({ where: { pollId } }),
      this.prisma.poll.delete({ where: { id: pollId } }),
    ]);
    return true;
  }

  async closeOtherActivePolls(poolId: string, exceptPollId: string) {
    await this.prisma.poll.updateMany({
      where: { poolId, status: 'active', id: { not: exceptPollId } },
      data: { status: 'closed', closedAt: new Date() },
    });
  }

  async launch(id: string) {
    return this.prisma.poll.update({
      where: { id },
      data: { status: 'active', sentAt: new Date() },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }

  async close(id: string) {
    return this.prisma.poll.update({
      where: { id },
      data: { status: 'closed', closedAt: new Date() },
    });
  }

  async respond(pollId: string, participantId: string, data: { pollOptionId?: string; freeText?: string }) {
    return this.prisma.pollResponse.upsert({
      where: { pollId_participantId: { pollId, participantId } },
      create: {
        pollId,
        participantId,
        pollOptionId: data.pollOptionId || null,
        freeText: data.freeText || null,
      },
      update: {
        pollOptionId: data.pollOptionId || null,
        freeText: data.freeText || null,
      },
    });
  }

  async getResults(pollId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          orderBy: { position: 'asc' },
          include: { _count: { select: { responses: true } } },
        },
        _count: { select: { responses: true } },
      },
    });
    return poll;
  }

  toPublicResults(full: PollResultsFull): PollPublicResults {
    return {
      id: full.id,
      questionText: full.questionText,
      type: full.type,
      showResultsToParticipants: full.showResultsToParticipants,
      totalResponses: full._count.responses,
      options: full.options.map((o) => ({
        id: o.id,
        text: o.text,
        position: o.position,
        responseCount: o._count.responses,
      })),
    };
  }
}
