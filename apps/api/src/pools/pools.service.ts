import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PoolsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async create(creatorId: string, data: { title: string; description?: string; genre: string; isPublic?: boolean; accessKey?: string; requireIdentification?: boolean; customFilterRules?: string }) {
    let code: string;
    do {
      code = this.generateCode();
    } while (await this.prisma.pool.findUnique({ where: { code } }));

    if (!data.isPublic && !data.accessKey) {
      data.accessKey = this.generateCode();
    }

    return this.prisma.pool.create({
      data: { ...data, code, creatorId, status: 'draft' },
    });
  }

  async findByCode(code: string) {
    return this.prisma.pool.findUnique({ where: { code }, include: { creator: { select: { id: true, name: true, avatarUrl: true } } } });
  }

  async findById(id: string) {
    return this.prisma.pool.findUnique({ where: { id }, include: { creator: { select: { id: true, name: true, avatarUrl: true } } } });
  }

  async findPublicLiveMeta(id: string) {
    const pool = await this.prisma.pool.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (!pool) throw new NotFoundException('Pool not found');

    const requiresAccessKey = !pool.isPublic && !!pool.accessKey;

    return {
      id: pool.id,
      code: pool.code,
      title: pool.title,
      description: pool.description,
      genre: pool.genre,
      isPublic: pool.isPublic,
      status: pool.status,
      requireIdentification: pool.requireIdentification,
      creator: pool.creator,
      requiresAccessKey,
    };
  }

  async findByCreator(creatorId: string) {
    return this.prisma.pool.findMany({ where: { creatorId }, orderBy: { createdAt: 'desc' } });
  }

  async findJoinedPools(userId: string) {
    return this.prisma.pool.findMany({
      where: { participants: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(id: string, status: string) {
    const data: any = { status };
    if (status === 'active') data.openedAt = new Date();
    if (status === 'closed') data.closedAt = new Date();
    return this.prisma.pool.update({ where: { id }, data });
  }

  async update(id: string, data: any) {
    return this.prisma.pool.update({ where: { id }, data });
  }

  async joinPool(poolId: string, data: { displayName?: string; isAnonymous?: boolean; accessKey?: string }, userId?: string) {
    const pool = await this.prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) throw new NotFoundException('Pool not found');

    if (!pool.isPublic && pool.accessKey && data.accessKey !== pool.accessKey) {
      throw new ForbiddenException('Invalid access key');
    }

    if (userId) {
      const existing = await this.prisma.participant.findUnique({
        where: { poolId_userId: { poolId, userId } },
      });
      if (existing) return existing;
    }

    const sessionToken = uuidv4();
    return this.prisma.participant.create({
      data: {
        poolId,
        userId: userId || null,
        displayName: data.displayName || null,
        isAnonymous: data.isAnonymous ?? true,
        sessionToken,
      },
    });
  }

  async getParticipantCount(poolId: string) {
    return this.prisma.participant.count({ where: { poolId } });
  }

  async deleteForCreator(id: string, userId: string) {
    const pool = await this.prisma.pool.findUnique({ where: { id } });
    if (!pool) throw new NotFoundException('Pool not found');
    if (pool.creatorId !== userId) throw new ForbiddenException('Only the pool creator can delete this pool');

    await this.prisma.$transaction(async (tx) => {
      await tx.questionVote.deleteMany({
        where: {
          OR: [{ question: { poolId: id } }, { cluster: { poolId: id } }, { participant: { poolId: id } }],
        },
      });
      await tx.question.deleteMany({ where: { poolId: id } });
      await tx.questionCluster.deleteMany({ where: { poolId: id } });
      await tx.pollResponse.deleteMany({ where: { poll: { poolId: id } } });
      await tx.pollOption.deleteMany({ where: { poll: { poolId: id } } });
      await tx.poll.deleteMany({ where: { poolId: id } });
      await tx.participant.deleteMany({ where: { poolId: id } });
      await tx.pool.delete({ where: { id } });
    });
  }
}
