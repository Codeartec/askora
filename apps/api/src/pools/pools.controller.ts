import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PoolsService } from './pools.service';
import { PollsService } from '../polls/polls.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt.guard';

@Controller('pools')
export class PoolsController {
  constructor(
    private readonly poolsService: PoolsService,
    private readonly pollsService: PollsService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req: any, @Body() body: any) {
    return this.poolsService.create(req.user.id, body);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  getMyPools(@Req() req: any) {
    return this.poolsService.findByCreator(req.user.id);
  }

  @Get('joined')
  @UseGuards(AuthGuard('jwt'))
  getJoinedPools(@Req() req: any) {
    return this.poolsService.findJoinedPools(req.user.id);
  }

  @Get('code/:code')
  getByCode(@Param('code') code: string) {
    return this.poolsService.findByCode(code.toUpperCase());
  }

  @Get('public/:id')
  getPublicLiveMeta(@Param('id') id: string) {
    return this.poolsService.findPublicLiveMeta(id);
  }

  @Get(':id/polls/drafts')
  @UseGuards(AuthGuard('jwt'))
  async listDraftPolls(@Param('id') poolId: string, @Req() req: any) {
    const pool = await this.poolsService.findById(poolId);
    if (!pool) throw new NotFoundException('Pool not found');
    if (pool.creatorId !== req.user.id) throw new ForbiddenException();
    return this.pollsService.findDraftsByPoolId(poolId);
  }

  @Get(':id/polls/completed')
  @UseGuards(AuthGuard('jwt'))
  async listCompletedPolls(
    @Param('id') poolId: string,
    @Req() req: any,
    @Query('limit') limitRaw?: string,
  ) {
    const pool = await this.poolsService.findById(poolId);
    if (!pool) throw new NotFoundException('Pool not found');
    if (pool.creatorId !== req.user.id) throw new ForbiddenException();
    const parsed =
      limitRaw == null || limitRaw === '' ? NaN : Number.parseInt(limitRaw, 10);
    const take = Number.isFinite(parsed) ? parsed : 50;
    return this.pollsService.findClosedByPoolId(poolId, take);
  }

  @Delete(':id/polls/:pollId')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  async deleteDraftPoll(@Param('id') poolId: string, @Param('pollId') pollId: string, @Req() req: any) {
    const pool = await this.poolsService.findById(poolId);
    if (!pool) throw new NotFoundException('Pool not found');
    if (pool.creatorId !== req.user.id) throw new ForbiddenException();
    const ok = await this.pollsService.deleteDraft(pollId, poolId);
    if (!ok) throw new NotFoundException('Draft poll not found');
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  getById(@Param('id') id: string, @Req() req: any) {
    return this.poolsService.findByIdForOwner(id, req.user.id);
  }

  @Patch(':id/status')
  @UseGuards(AuthGuard('jwt'))
  updateStatus(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    return this.poolsService.updateStatus(id, status, req.user.id);
  }

  @Post(':id/join')
  @UseGuards(OptionalJwtAuthGuard)
  async joinPool(@Param('id') id: string, @Body() body: { displayName?: string; isAnonymous?: boolean; accessKey?: string }, @Req() req: any) {
    return this.poolsService.joinPool(id, body, req.user?.id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.poolsService.update(id, body, req.user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AuthGuard('jwt'))
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.poolsService.deleteForCreator(id, req.user.id);
  }
}
