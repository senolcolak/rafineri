import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AdminService } from '../../src/admin/admin.service';
import { RedisService } from '../../src/database/redis.service';
import { DRIZZLE_PROVIDER } from '../../src/database/database.module';

describe('AdminService', () => {
  let service: AdminService;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      onConflictDoUpdate: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ version: 2 }]),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    mockRedis = {
      getClient: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
      del: jest.fn().mockResolvedValue(undefined),
      deletePattern: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: DRIZZLE_PROVIDER,
          useValue: mockDb,
        },
        {
          provide: RedisService,
          useValue: mockRedis,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns default settings when no persisted record exists', async () => {
    const settings = await service.getSettings();
    expect(settings.version).toBe(1);
    expect(settings.settings).toMatchObject({
      hnConcurrency: 5,
      redditLimit: 25,
      requireApproval: false,
    });
  });

  it('validates setting ranges on update', async () => {
    await expect(
      service.updateSettings({
        hnConcurrency: 99,
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('persists settings updates and increments version', async () => {
    const result = await service.updateSettings({
      hnConcurrency: 7,
      version: 1,
      updatedBy: 3,
    });

    expect(result.success).toBe(true);
    expect(result.version).toBe(2);
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
