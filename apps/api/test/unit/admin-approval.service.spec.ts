import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminApprovalService } from '../../src/admin/admin-approval.service';
import { DRIZZLE_PROVIDER } from '../../src/database/database.module';

describe('AdminApprovalService', () => {
  let service: AdminApprovalService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminApprovalService,
        {
          provide: DRIZZLE_PROVIDER,
          useValue: mockDb,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'redis.host') return 'localhost';
              if (key === 'redis.port') return 6379;
              if (key === 'redis.db') return 0;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AdminApprovalService>(AdminApprovalService);
    (service as any).queue = { add: jest.fn().mockResolvedValue(undefined), close: jest.fn() };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('throws when submitting request for missing story', async () => {
    mockDb.limit.mockResolvedValueOnce([]);
    await expect(
      service.submitRequest({
        storyId: 999,
        claim: 'missing story',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('queues request when story exists', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 1 }]); // story lookup
    mockDb.returning.mockResolvedValueOnce([{ id: 11, status: 'queued' }]); // inserted request

    const result = await service.submitRequest({
      storyId: 1,
      claim: 'Claim text',
      submittedBy: 10,
    });

    expect(result.requestId).toBe('11');
    expect(result.status).toBe('queued');
    expect((service as any).queue.add).toHaveBeenCalled();
  });

  it('returns details for existing request', async () => {
    mockDb.limit.mockResolvedValueOnce([
      {
        id: 7,
        storyId: 3,
        status: 'processing',
        priority: 0,
        finalConfidence: null,
        finalReason: null,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
        updatedAt: new Date('2026-01-01T10:00:00.000Z'),
        startedAt: null,
        completedAt: null,
      },
    ]);
    mockDb.orderBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getRequest(7);
    expect(result.id).toBe('7');
    expect(result.status).toBe('processing');
    expect(Array.isArray(result.steps)).toBe(true);
  });
});
