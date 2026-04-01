import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { PoolsService } from './pools.service';
import { QuestionsService } from '../questions/questions.service';
import { ModerationService } from '../moderation/moderation.service';
import { MergeService } from '../questions/merge.service';
import { QuestionSimilarityService } from '../questions/question-similarity.service';
import { PollsService } from '../polls/polls.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class PoolsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(PoolsGateway.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private poolsService: PoolsService,
    private questionsService: QuestionsService,
    private moderationService: ModerationService,
    private mergeService: MergeService,
    private questionSimilarityService: QuestionSimilarityService,
    private pollsService: PollsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const auth = client.handshake?.auth;
      if (auth?.token) {
        const payload = this.jwtService.verify(auth.token);
        const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (user) {
          client.data = { ...client.data, user, authType: 'jwt' };
          this.logger.log(`User connected: ${user.email}`);
          return;
        }
      }
      if (auth?.sessionToken) {
        const participant = await this.prisma.participant.findUnique({
          where: { sessionToken: auth.sessionToken },
        });
        if (participant) {
          client.data = { ...client.data, participant, authType: 'session' };
          this.logger.log(`Participant connected: ${participant.id}`);
          return;
        }
      }
      client.data = { ...client.data, authType: 'anonymous' };
      this.logger.log(`Anonymous connection: ${client.id}`);
    } catch (err) {
      client.data = { ...client.data, authType: 'anonymous' };
      this.logger.warn(`Auth failed for ${client.id}, allowing as anonymous`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const poolCode = client.data?.poolCode as string | undefined;
    if (poolCode) {
      void this.broadcastParticipantRoster(poolCode);
    }
  }

  @SubscribeMessage('pool:join')
  async handleJoinPool(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { poolCode: string; accessKey?: string },
  ) {
    const pool = await this.poolsService.findByCode(data.poolCode.toUpperCase());
    if (!pool) {
      client.emit('error', { message: 'Pool not found' });
      return;
    }

    const roomName = `pool:${pool.code}`;
    client.join(roomName);
    client.data.poolCode = pool.code;
    client.data.poolId = pool.id;

    const jwtUserId = this.resolveJwtUserId(client);
    // Hydrate JWT user before participantId / admin so we are not blocked by async handleConnection
    if (jwtUserId && !client.data.user) {
      const user = await this.prisma.user.findUnique({ where: { id: jwtUserId } });
      if (user) {
        client.data = { ...client.data, user, authType: 'jwt' };
      }
    }

    // Resolve participantId from session or user
    if (client.data.participant) {
      client.data.participantId = client.data.participant.id;
    } else if (client.data.user) {
      const existing = await this.prisma.participant.findFirst({
        where: { poolId: pool.id, userId: client.data.user.id },
      });
      if (existing) client.data.participantId = existing.id;
    }

    if (jwtUserId === pool.creatorId) {
      client.join(`${roomName}:admin`);
    }

    const isCreator = jwtUserId === pool.creatorId;
    const handshakeSessionToken = client.handshake?.auth?.sessionToken as string | undefined;

    // `handleConnection` is async and may not have hydrated `client.data` yet when the first message arrives.
    // Try to resolve participant from handshake sessionToken here as well.
    if (!client.data?.participant && handshakeSessionToken) {
      const participant = await this.prisma.participant.findUnique({
        where: { sessionToken: handshakeSessionToken },
      });
      if (participant) {
        client.data = { ...client.data, participant, authType: 'session' };
        client.data.participantId = participant.id;
      }
    }

    const hasSessionParticipant = !!client.data?.participantId || !!client.data?.participant?.id;

    // For private pools, require accessKey only for unauthenticated clients.
    // - Host (JWT creator) is allowed without accessKey
    // - Participants who already joined via HTTP and present a valid sessionToken are allowed without accessKey
    if (!pool.isPublic && pool.accessKey && !isCreator && !hasSessionParticipant && data.accessKey !== pool.accessKey) {
      client.emit('error', { message: 'Invalid access key' });
      return;
    }

    const participantCount = await this.poolsService.getParticipantCount(pool.id);

    this.server.to(`${roomName}:admin`).emit('participant:joined', {
      count: participantCount,
      socketId: client.id,
    });

    const includeSources = jwtUserId === pool.creatorId;
    const displayItems = await this.questionsService.buildDisplayItems(pool.id, includeSources);

    const resolvedItems =
      includeSources || pool.showResolvedToParticipants
        ? await this.questionsService.buildResolvedDisplayItems(pool.id, includeSources)
        : [];

    const activePollRow = await this.pollsService.findActiveByPoolId(pool.id);
    const activePoll = activePollRow
      ? {
          poll: {
            id: activePollRow.id,
            questionText: activePollRow.questionText,
            type: activePollRow.type,
            showResultsToParticipants: activePollRow.showResultsToParticipants,
          },
          options: activePollRow.options,
        }
      : null;

    const pendingHostQuestions =
      jwtUserId === pool.creatorId
        ? await this.questionsService.findPendingHostDecisionByPool(pool.id)
        : undefined;

    const aiPayload =
      jwtUserId === pool.creatorId
        ? {
            status: pool.aiStatus as 'healthy' | 'degraded',
            degradedMode: pool.aiDegradedMode,
            degradedSince: pool.aiDegradedSince?.toISOString() ?? null,
          }
        : undefined;

    client.emit('pool:joined', {
      pool: {
        id: pool.id,
        code: pool.code,
        title: pool.title,
        description: pool.description,
        status: pool.status,
        genre: pool.genre,
        creator: pool.creator,
        lastQuestionMergeAt: pool.lastQuestionMergeAt?.toISOString() ?? null,
        questionsSinceMerge: pool.questionsSinceMerge,
        showResolvedToParticipants: pool.showResolvedToParticipants,
        ...(aiPayload
          ? {
              aiStatus: aiPayload.status,
              aiDegradedMode: aiPayload.degradedMode,
              aiDegradedSince: aiPayload.degradedSince,
            }
          : {}),
      },
      displayItems,
      resolvedItems,
      participantCount,
      activePoll,
      ...(pendingHostQuestions !== undefined ? { pendingHostQuestions } : {}),
      ...(aiPayload !== undefined ? { ai: aiPayload } : {}),
    });

    if (jwtUserId === pool.creatorId && activePollRow) {
      const snapshot = await this.pollsService.getResults(activePollRow.id);
      if (snapshot) {
        client.emit('poll:response-received', { pollId: activePollRow.id, results: snapshot });
      }
    }

    void this.broadcastParticipantRoster(pool.code);
  }

  @SubscribeMessage('pool:update-status')
  async handleUpdateStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: string },
  ) {
    if (!(await this.ensureJwtAuth(client))) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const poolCode = client.data.poolCode;
    if (!poolCode) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user.id) {
      client.emit('error', { message: 'Not the pool creator' });
      return;
    }

    const updated = await this.poolsService.updateStatus(pool.id, data.status, client.data.user.id);
    this.server.to(`pool:${poolCode}`).emit('pool:status-changed', { status: updated.status });
  }

  @SubscribeMessage('pool:set-show-resolved')
  async handleSetShowResolved(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { showResolvedToParticipants: boolean },
  ) {
    if (!(await this.ensureJwtAuth(client))) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const poolCode = client.data.poolCode;
    const poolId = client.data.poolId;
    if (!poolCode || !poolId) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user.id) {
      client.emit('error', { message: 'Not the pool creator' });
      return;
    }

    await this.prisma.pool.update({
      where: { id: poolId },
      data: { showResolvedToParticipants: !!data.showResolvedToParticipants },
    });

    await this.broadcastDisplaySync(poolCode, poolId, pool.creatorId);
  }

  @SubscribeMessage('pool:set-ai-degraded-mode')
  async handleSetAiDegradedMode(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mode: 'manual_approval' | 'wait_for_ai' },
  ) {
    if (!(await this.ensureJwtAuth(client))) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const poolCode = client.data.poolCode;
    const poolId = client.data.poolId;
    if (!poolCode || !poolId) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user.id) {
      client.emit('error', { message: 'Not the pool creator' });
      return;
    }

    if (pool.aiStatus !== 'degraded') {
      client.emit('error', { message: 'AI is not degraded' });
      return;
    }

    const updated = await this.prisma.pool.update({
      where: { id: poolId },
      data: { aiDegradedMode: data.mode },
    });

    this.server.to(`pool:${poolCode}:admin`).emit('ai:status-changed', {
      status: 'degraded',
      degradedMode: updated.aiDegradedMode,
      degradedSince: updated.aiDegradedSince?.toISOString() ?? null,
    });
  }

  @SubscribeMessage('question:submit')
  async handleQuestionSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { text: string },
  ) {
    const participantId = this.getParticipantId(client);
    const poolId = client.data.poolId;
    const poolCode = client.data.poolCode;
    if (!participantId || !poolId || !poolCode) {
      client.emit('error', { message: 'Not in a pool' });
      return;
    }

    const pool = await this.prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool || pool.status !== 'active') {
      client.emit('error', { message: 'Pool is not accepting questions' });
      return;
    }

    const modResult = await this.moderationService.moderateQuestion(
      data.text,
      pool.customFilterRules,
    );

    if (!modResult.llmUnavailable) {
      await this.markAiHealthyAndReprocess(poolId, poolCode, pool.creatorId, {
        aiStatus: pool.aiStatus,
        aiDegradedMode: pool.aiDegradedMode,
        customFilterRules: pool.customFilterRules,
      });
    }

    if (modResult.llmUnavailable) {
      const question = await this.questionsService.create({
        poolId,
        participantId,
        originalText: data.text,
        moderationStatus: 'pending_host_decision',
        moderationReason: null,
      });

      await this.prisma.pool.update({
        where: { id: poolId },
        data: {
          aiStatus: 'degraded',
          ...(!pool.aiDegradedSince ? { aiDegradedSince: new Date() } : {}),
        },
      });

      const poolAfter = await this.prisma.pool.findUnique({ where: { id: poolId } });

      this.server.to(`pool:${poolCode}:admin`).emit('ai:status-changed', {
        status: 'degraded',
        degradedMode: poolAfter?.aiDegradedMode ?? null,
        degradedSince: poolAfter?.aiDegradedSince?.toISOString() ?? null,
      });

      this.server.to(`pool:${poolCode}:admin`).emit('question:pending-host-decision', {
        question,
        moderationStatus: 'pending_host_decision',
      });

      client.emit('question:submitted', { status: 'pending_ai' });
      return;
    }

    let moderationStatus = 'approved';
    let moderationReason: string | null = null;
    if (modResult.standardViolation) {
      moderationStatus = 'flagged_standard';
      moderationReason = modResult.standardReason;
    } else if (modResult.customViolation) {
      moderationStatus = 'flagged_custom';
      moderationReason = modResult.customReason;
    }

    const question = await this.questionsService.create({
      poolId,
      participantId,
      originalText: data.text,
      moderationStatus,
      moderationReason,
    });

    if (moderationStatus === 'approved') {
      const similarityHint = await this.questionSimilarityService.findHintForNewQuestion(
        poolId,
        data.text,
        question.id,
        pool.showResolvedToParticipants,
      );

      await this.broadcastQuestionApproveEffects(poolId, poolCode, question.id, pool.creatorId);

      client.emit('question:submitted', {
        status: 'ok',
        ...(similarityHint ? { similarityHint } : {}),
      });
    } else {
      this.server.to(`pool:${poolCode}:admin`).emit('question:flagged', {
        question,
        moderationStatus,
        reason: moderationReason,
      });
      client.emit('question:submitted', { status: 'pending_review' });
    }
  }

  @SubscribeMessage('question:vote')
  async handleQuestionVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { questionId?: string; clusterId?: string },
  ) {
    const participantId = this.getParticipantId(client);
    const poolCode = client.data.poolCode;
    if (!participantId || !poolCode) {
      client.emit('error', { message: 'Not in a pool' });
      return;
    }

    if (!data.questionId && !data.clusterId) {
      client.emit('error', { message: 'questionId or clusterId required' });
      return;
    }

    const res = await this.questionsService.voteOnTarget(participantId, data.questionId, data.clusterId);
    if (!res) {
      client.emit('error', { message: 'Invalid vote target' });
      return;
    }

    this.server.to(`pool:${poolCode}`).emit('question:vote-updated', {
      targetKind: res.targetKind,
      targetId: res.targetId,
      voteCount: res.voteCount,
      voted: res.voted,
    });
  }

  @SubscribeMessage('question:moderate')
  async handleQuestionModerate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { questionId: string; action: 'approve' | 'reject' },
  ) {
    if (!(await this.ensureJwtAuth(client))) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const poolCode = client.data.poolCode;
    if (!poolCode) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user.id) {
      client.emit('error', { message: 'Not the pool creator' });
      return;
    }

    if (data.action === 'approve') {
      await this.questionsService.updateModeration(data.questionId, 'approved');
      await this.broadcastQuestionApproveEffects(pool.id, poolCode, data.questionId, pool.creatorId);
      this.server.to(`pool:${poolCode}:admin`).emit('question:pending-host-resolved', {
        questionId: data.questionId,
      });
    } else {
      await this.questionsService.updateModeration(data.questionId, 'rejected');
      this.server.to(`pool:${poolCode}:admin`).emit('question:pending-host-resolved', {
        questionId: data.questionId,
      });
    }

    client.emit('question:moderated', { questionId: data.questionId, action: data.action });
  }

  @SubscribeMessage('display-item:mark-answered')
  async handleDisplayItemMarkAnswered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { questionId?: string; clusterId?: string },
  ) {
    if (!(await this.ensureJwtAuth(client))) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const poolCode = client.data.poolCode;
    const poolId = client.data.poolId;
    if (!poolCode || !poolId) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user.id) {
      client.emit('error', { message: 'Not the pool creator' });
      return;
    }

    const result = await this.questionsService.markDisplayItemAnswered({
      poolId,
      questionId: data.questionId,
      clusterId: data.clusterId,
    });

    if (!result.ok) {
      client.emit('error', { message: 'Cannot mark as answered' });
      return;
    }

    await this.broadcastDisplaySync(poolCode, poolId, pool.creatorId);
  }

  @SubscribeMessage('llm:trigger-merge')
  async handleTriggerMerge(
    @ConnectedSocket() client: Socket,
  ) {
    if (!(await this.ensureJwtAuth(client))) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const poolCode = client.data.poolCode;
    const poolId = client.data.poolId;
    if (!poolCode || !poolId) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user.id) {
      client.emit('error', { message: 'Not the pool creator' });
      return;
    }

    client.emit('llm:merge-started', {});

    const result = await this.mergeService.runMergePass(poolId);
    await this.broadcastDisplaySync(poolCode, poolId, pool.creatorId);

    client.emit('llm:merge-completed', { clustersCreated: result.clusters.length });
  }

  @SubscribeMessage('poll:create')
  async handlePollCreate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      questionText: string;
      type: string;
      options?: string[];
      showResultsToParticipants?: boolean;
      asDraft?: boolean;
    },
  ) {
    if (!(await this.ensureJwtAuth(client))) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    const poolId = client.data.poolId;
    const poolCode = client.data.poolCode;
    if (!poolId || !poolCode) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user.id) {
      client.emit('error', { message: 'Not the pool creator' });
      return;
    }

    const created = await this.pollsService.create(poolId, data);
    if (!created) return;

    if (data.asDraft) {
      client.emit('poll:created', { poll: created });
      return;
    }

    await this.pollsService.closeOtherActivePolls(poolId, created.id);
    const launched = await this.pollsService.launch(created.id);
    client.emit('poll:created', { poll: launched });
    this.broadcastPollLaunched(poolCode, launched);
  }

  @SubscribeMessage('poll:launch')
  async handlePollLaunch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pollId: string },
  ) {
    if (!(await this.ensureJwtAuth(client))) return;
    const poolCode = client.data.poolCode;
    const poolId = client.data.poolId;
    if (!poolCode || !poolId) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user?.id) return;

    const pollRow = await this.prisma.poll.findFirst({
      where: { id: data.pollId, poolId },
    });
    if (!pollRow) return;

    if (pollRow.status !== 'draft') {
      client.emit('error', { message: 'Poll is not a draft' });
      return;
    }

    await this.pollsService.closeOtherActivePolls(poolId, data.pollId);
    const poll = await this.pollsService.launch(data.pollId);
    this.broadcastPollLaunched(poolCode, poll);
  }

  @SubscribeMessage('poll:respond')
  async handlePollRespond(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pollId: string; pollOptionId?: string; freeText?: string },
  ) {
    const participantId = this.getParticipantId(client);
    const poolCode = client.data.poolCode;
    if (!participantId || !poolCode) return;

    await this.pollsService.respond(data.pollId, participantId, {
      pollOptionId: data.pollOptionId,
      freeText: data.freeText,
    });

    const results = await this.pollsService.getResults(data.pollId);
    this.server.to(`pool:${poolCode}:admin`).emit('poll:response-received', {
      pollId: data.pollId,
      results,
    });
  }

  @SubscribeMessage('poll:close')
  async handlePollClose(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { pollId: string },
  ) {
    if (!(await this.ensureJwtAuth(client))) return;
    const poolCode = client.data.poolCode;
    const poolId = client.data.poolId;
    if (!poolCode || !poolId) return;

    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool || pool.creatorId !== client.data.user?.id) return;

    const pollRow = await this.prisma.poll.findFirst({
      where: { id: data.pollId, poolId },
    });
    if (!pollRow) return;

    const show = pollRow.showResultsToParticipants;
    await this.pollsService.close(data.pollId);
    const full = await this.pollsService.getResults(data.pollId);
    if (!full) return;

    const roomName = `pool:${poolCode}`;
    const publicResults = show ? this.pollsService.toPublicResults(full) : null;

    this.server.to(`${roomName}:admin`).emit('poll:closed', {
      pollId: data.pollId,
      showResultsToParticipants: show,
      results: full,
    });

    this.server.to(roomName).except(`${roomName}:admin`).emit('poll:closed', {
      pollId: data.pollId,
      showResultsToParticipants: show,
      results: publicResults,
    });
  }

  private resolveJwtUserIdFromHandshake(client: { data?: any; handshake?: any }): string | undefined {
    if (client.data?.user?.id) {
      return client.data.user.id;
    }
    const token = client.handshake?.auth?.token as string | undefined;
    if (!token) return undefined;
    try {
      const payload = this.jwtService.verify(token) as { sub: string };
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  private resolveJwtUserId(client: Socket): string | undefined {
    return this.resolveJwtUserIdFromHandshake(client);
  }

  private async ensureJwtAuth(client: Socket): Promise<boolean> {
    if (client.data?.authType === 'jwt' && client.data?.user) return true;
    const token = client.handshake?.auth?.token as string | undefined;
    if (!token) return false;
    try {
      const payload = this.jwtService.verify(token) as { sub: string };
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (user) {
        client.data = { ...client.data, user, authType: 'jwt' };
        return true;
      }
    } catch {}
    return false;
  }

  private remoteIsPoolCreator(remote: { data?: any; handshake?: any }, creatorId: string): boolean {
    const uid = this.resolveJwtUserIdFromHandshake(remote);
    return uid !== undefined && uid === creatorId;
  }

  /** Roster badge: use participant.userId when present (avoids JWT shadowing session on shared browsers). */
  private rosterIsHost(remote: { data?: any; handshake?: any }, creatorId: string): boolean {
    const data = remote.data as {
      participant?: { userId?: string | null };
      user?: { id: string };
    } | undefined;
    if (data?.participant) {
      const uid = data.participant.userId;
      if (uid != null && uid !== '') {
        return uid === creatorId;
      }
      return false;
    }
    if (data?.user?.id) {
      return data.user.id === creatorId;
    }
    return false;
  }

  private getParticipantId(client: Socket): string | null {
    if (client.data.participant) return client.data.participant.id;
    return client.data.participantId || null;
  }

  private broadcastPollLaunched(
    poolCode: string,
    poll: {
      id: string;
      questionText: string;
      type: string;
      showResultsToParticipants: boolean;
      options: { id: string; text: string; position: number }[];
    },
  ) {
    this.server.to(`pool:${poolCode}`).emit('poll:launched', {
      poll: {
        id: poll.id,
        questionText: poll.questionText,
        type: poll.type,
        showResultsToParticipants: poll.showResultsToParticipants,
      },
      options: poll.options,
    });
  }

  private async broadcastDisplaySync(poolCode: string, poolId: string, creatorId: string) {
    const poolRow = await this.prisma.pool.findUnique({ where: { id: poolId } });
    if (!poolRow) return;

    const poolSlice = {
      lastQuestionMergeAt: poolRow.lastQuestionMergeAt?.toISOString() ?? null,
      questionsSinceMerge: poolRow.questionsSinceMerge,
      showResolvedToParticipants: poolRow.showResolvedToParticipants,
    };

    const publicItems = await this.questionsService.buildDisplayItems(poolId, false);
    const adminItems = await this.questionsService.buildDisplayItems(poolId, true);
    const resolvedPublic = await this.questionsService.buildResolvedDisplayItems(poolId, false);
    const resolvedAdmin = await this.questionsService.buildResolvedDisplayItems(poolId, true);
    const roomName = `pool:${poolCode}`;
    const sockets = await this.server.in(roomName).fetchSockets();

    for (const s of sockets) {
      const isCreator = this.remoteIsPoolCreator(s, creatorId);
      const items = isCreator ? adminItems : publicItems;
      const resolvedItems =
        isCreator || poolRow.showResolvedToParticipants ? (isCreator ? resolvedAdmin : resolvedPublic) : [];
      s.emit('questions:merged-sync', { displayItems: items, pool: poolSlice, resolvedItems });
    }
  }

  private async broadcastParticipantRoster(poolCode: string) {
    const pool = await this.poolsService.findByCode(poolCode);
    if (!pool) return;

    const roomName = `pool:${poolCode}`;
    const sockets = await this.server.in(roomName).fetchSockets();

    let hostSocketCount = 0;
    const namedDraft: { id: string; displayName: string; isHost: boolean }[] = [];
    let anonymousCount = 0;

    for (const remote of sockets) {
      if (this.remoteIsPoolCreator(remote, pool.creatorId)) {
        hostSocketCount += 1;
      }

      const rosterHost = this.rosterIsHost(remote, pool.creatorId);

      const data = remote.data as {
        participant?: { id: string; displayName: string | null; isAnonymous: boolean; userId?: string | null };
        user?: { id: string; name: string };
      };

      if (data.participant) {
        const p = data.participant;
        if (p.isAnonymous || !p.displayName) {
          anonymousCount += 1;
        } else {
          namedDraft.push({ id: p.id, displayName: p.displayName, isHost: rosterHost });
        }
      } else if (data.user) {
        namedDraft.push({ id: data.user.id, displayName: data.user.name, isHost: rosterHost });
      } else {
        anonymousCount += 1;
      }
    }

    const byId = new Map<string, { id: string; displayName: string; isHost: boolean }>();
    for (const n of namedDraft) {
      const prev = byId.get(n.id);
      if (!prev) {
        byId.set(n.id, n);
      } else {
        byId.set(n.id, { ...prev, isHost: prev.isHost || n.isHost });
      }
    }

    let named = [...byId.values()];

    if (hostSocketCount > 0 && !named.some((n) => n.isHost)) {
      named.unshift({
        id: pool.creatorId,
        displayName: pool.creator.name,
        isHost: true,
      });
    }

    named.sort((a, b) => {
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });

    const audienceConnected = Math.max(0, sockets.length - hostSocketCount);

    this.server.to(roomName).emit('participants:live-count', { audienceConnected });

    this.server.to(`${roomName}:admin`).emit('participants:roster', {
      connectedTotal: sockets.length,
      audienceConnected,
      anonymousCount,
      named,
    });
  }

  private async broadcastQuestionApproveEffects(
    poolId: string,
    poolCode: string,
    questionId: string,
    _creatorId: string,
  ): Promise<void> {
    const updatedPool = await this.prisma.pool.update({
      where: { id: poolId },
      data: { questionsSinceMerge: { increment: 1 } },
      select: { questionsSinceMerge: true, creatorId: true },
    });

    if (updatedPool.questionsSinceMerge >= 3) {
      await this.mergeService.runMergePass(poolId);
      await this.broadcastDisplaySync(poolCode, poolId, updatedPool.creatorId);
    } else {
      const enriched = await this.questionsService.enrichQuestionForEmit(questionId);
      if (enriched) {
        const displayItem = this.questionsService.standaloneQuestionToDisplayItem(enriched);
        this.server.to(`pool:${poolCode}`).emit('question:new', { displayItem });
      }
    }
  }

  private async markAiHealthyAndReprocess(
    poolId: string,
    poolCode: string,
    creatorId: string,
    poolRow: { aiStatus: string; aiDegradedMode: string | null; customFilterRules: string | null },
  ) {
    if (poolRow.aiStatus !== 'degraded') return;

    const wasWaitForAi = poolRow.aiDegradedMode === 'wait_for_ai';

    await this.prisma.pool.update({
      where: { id: poolId },
      data: {
        aiStatus: 'healthy',
        aiDegradedMode: null,
        aiDegradedSince: null,
      },
    });

    this.server.to(`pool:${poolCode}:admin`).emit('ai:status-changed', {
      status: 'healthy',
      degradedMode: null,
      degradedSince: null,
    });

    if (wasWaitForAi) {
      const pending = await this.questionsService.findPendingHostDecisionByPool(poolId);
      for (const q of pending) {
        await this.reprocessPendingQuestionWithLlm(poolId, poolCode, creatorId, q, poolRow.customFilterRules);
      }
    }
  }

  private async reprocessPendingQuestionWithLlm(
    poolId: string,
    poolCode: string,
    creatorId: string,
    q: {
      id: string;
      originalText: string;
      participant: { id: string; displayName: string | null; isAnonymous: boolean };
    },
    customFilterRules: string | null,
  ) {
    const mod = await this.moderationService.moderateQuestion(q.originalText, customFilterRules);
    if (mod.llmUnavailable) return;

    if (mod.standardViolation) {
      await this.prisma.question.update({
        where: { id: q.id },
        data: { moderationStatus: 'flagged_standard', moderationReason: mod.standardReason },
      });
      const row = await this.prisma.question.findUnique({
        where: { id: q.id },
        include: { participant: { select: { id: true, displayName: true, isAnonymous: true } } },
      });
      if (row) {
        this.server.to(`pool:${poolCode}:admin`).emit('question:flagged', {
          question: row,
          moderationStatus: 'flagged_standard',
          reason: mod.standardReason,
        });
      }
      this.server.to(`pool:${poolCode}:admin`).emit('question:pending-host-resolved', { questionId: q.id });
      return;
    }

    if (mod.customViolation) {
      await this.prisma.question.update({
        where: { id: q.id },
        data: { moderationStatus: 'flagged_custom', moderationReason: mod.customReason },
      });
      const row = await this.prisma.question.findUnique({
        where: { id: q.id },
        include: { participant: { select: { id: true, displayName: true, isAnonymous: true } } },
      });
      if (row) {
        this.server.to(`pool:${poolCode}:admin`).emit('question:flagged', {
          question: row,
          moderationStatus: 'flagged_custom',
          reason: mod.customReason,
        });
      }
      this.server.to(`pool:${poolCode}:admin`).emit('question:pending-host-resolved', { questionId: q.id });
      return;
    }

    await this.questionsService.updateModeration(q.id, 'approved');
    await this.broadcastQuestionApproveEffects(poolId, poolCode, q.id, creatorId);
    this.server.to(`pool:${poolCode}:admin`).emit('question:pending-host-resolved', { questionId: q.id });
  }

  emitToPool(poolCode: string, event: string, data: any) {
    this.server.to(`pool:${poolCode}`).emit(event, data);
  }

  emitToAdmin(poolCode: string, event: string, data: any) {
    this.server.to(`pool:${poolCode}:admin`).emit(event, data);
  }
}
