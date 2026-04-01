import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { PoolsController } from '../src/pools/pools.controller';
import { PoolsService } from '../src/pools/pools.service';
import { PollsService } from '../src/polls/polls.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthGuard } from '@nestjs/passport';

const OWNER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ID = '22222222-2222-2222-2222-222222222222';
const POOL_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const poolRow = {
  id: POOL_ID,
  code: 'ABC123',
  title: 'Test Pool',
  description: null,
  genre: 'tech',
  isPublic: true,
  accessKey: null,
  status: 'draft',
  requireIdentification: false,
  customFilterRules: null,
  creatorId: OWNER_ID,
  createdAt: new Date(),
  openedAt: null,
  closedAt: null,
};

const poolRowWithCreator = {
  ...poolRow,
  creator: { id: OWNER_ID, name: 'Owner', avatarUrl: null },
};

let currentUserId = OWNER_ID;

const mockJwtGuard: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = { id: currentUserId };
    return true;
  },
};

const prismaPool = {
  findUnique: jest.fn().mockImplementation(({ include }) => {
    if (include) return Promise.resolve(poolRowWithCreator);
    return Promise.resolve(poolRow);
  }),
  update: jest.fn().mockResolvedValue({ ...poolRow, status: 'active' }),
};

describe('Pools authorization (IDOR)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoolsController],
      providers: [
        PoolsService,
        { provide: PollsService, useValue: {} },
        {
          provide: PrismaService,
          useValue: { pool: prismaPool },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue(mockJwtGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    currentUserId = OWNER_ID;
    jest.clearAllMocks();
    prismaPool.findUnique.mockImplementation(({ include }) => {
      if (include) return Promise.resolve(poolRowWithCreator);
      return Promise.resolve(poolRow);
    });
    prismaPool.update.mockResolvedValue({ ...poolRow, status: 'active' });
  });

  // --- GET /pools/:id ---

  it('GET /pools/:id — owner can read their pool', async () => {
    const res = await request(app.getHttpServer()).get(`/pools/${POOL_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(POOL_ID);
  });

  it('GET /pools/:id — non-owner receives 403', async () => {
    currentUserId = OTHER_ID;
    const res = await request(app.getHttpServer()).get(`/pools/${POOL_ID}`);
    expect(res.status).toBe(403);
  });

  // --- PATCH /pools/:id/status ---

  it('PATCH /pools/:id/status — owner can update status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/pools/${POOL_ID}/status`)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
  });

  it('PATCH /pools/:id/status — non-owner receives 403', async () => {
    currentUserId = OTHER_ID;
    const res = await request(app.getHttpServer())
      .patch(`/pools/${POOL_ID}/status`)
      .send({ status: 'active' });
    expect(res.status).toBe(403);
  });

  // --- PATCH /pools/:id ---

  it('PATCH /pools/:id — owner can update pool', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/pools/${POOL_ID}`)
      .send({ title: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('PATCH /pools/:id — non-owner receives 403', async () => {
    currentUserId = OTHER_ID;
    const res = await request(app.getHttpServer())
      .patch(`/pools/${POOL_ID}`)
      .send({ title: 'Hacked' });
    expect(res.status).toBe(403);
  });
});
