import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../../src/admin/admin.service';
import { RedisService } from '../../src/database/redis.service';
import { DRIZZLE_PROVIDER } from '../../src/database/database.module';
import { NotFoundException, InternalServerErrorException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let mockDb: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      execute: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn((fn) => fn(mockDb)),
    };

    mockRedis = {
      setJSON: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue({
        publish: jest.fn().mockResolvedValue(undefined),
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
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockReturnValue([{ count: 100 }]);

      const result = await service.getDashboardStats();

      expect(result).toHaveProperty('totalStories');
      expect(result).toHaveProperty('storiesToday');
      expect(result).toHaveProperty('systemHealth');
      expect(result.systemHealth).toHaveProperty('api', 'healthy');
    });

    it('should handle database errors gracefully', async () => {
      mockDb.select.mockImplementation(() => {
        throw new Error('DB Error');
      });

      await expect(service.getDashboardStats()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('rescoreStory', () => {
    const mockStory = {
      id: 1,
      title: 'Test Story',
      label: 'unverified',
      confidence: 0.5,
      hotScore: 50,
      verificationScore: 30,
      controversyScore: 10,
    };

    const mockClaimStats = {
      totalClaims: 2,
      verifiedCount: 1,
      disputedCount: 0,
      debunkedCount: 0,
    };

    beforeEach(() => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValue([mockStory]);
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.insert.mockReturnThis();
      mockDb.values.mockResolvedValue(undefined);
      mockDb.execute = jest.fn().mockResolvedValue(undefined);
    });

    it('should rescore a story successfully', async () => {
      const result = await service.rescoreStory(1);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('previousScores');
      expect(result.message).toBe('Story scores recalculated successfully');
    });

    it('should throw NotFoundException for non-existent story', async () => {
      mockDb.where = jest.fn().mockResolvedValue([]);

      await expect(service.rescoreStory(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should calculate correct label based on claims', async () => {
      mockDb.where = jest.fn()
        .mockResolvedValueOnce([mockStory])
        .mockResolvedValueOnce([{ totalClaims: 2, verifiedCount: 2, disputedCount: 0, debunkedCount: 0 }]);

      const result = await service.rescoreStory(1);

      expect(result.label).toBe('verified');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should mark story as contested if debunked claims exist', async () => {
      mockDb.where = jest.fn()
        .mockResolvedValueOnce([mockStory])
        .mockResolvedValueOnce([{ totalClaims: 2, verifiedCount: 0, disputedCount: 0, debunkedCount: 1 }]);

      const result = await service.rescoreStory(1);

      expect(result.label).toBe('contested');
    });
  });

  describe('getStories', () => {
    it('should return paginated stories', async () => {
      const mockStories = [
        { id: 1, title: 'Story 1', label: 'verified', category: 'tech' },
        { id: 2, title: 'Story 2', label: 'likely', category: 'science' },
      ];

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValue(mockStories);

      const result = await service.getStories({ page: 1, limit: 20 });

      expect(result).toHaveProperty('stories');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('totalPages');
      expect(Array.isArray(result.stories)).toBe(true);
    });

    it('should filter by search query', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValue([]);

      await service.getStories({ page: 1, limit: 20, q: 'technology' });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by label', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValue([]);

      await service.getStories({ page: 1, limit: 20, label: 'verified' });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('updateStory', () => {
    const mockStory = { id: 1, title: 'Original Title' };

    beforeEach(() => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValueOnce([mockStory]);
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();
      mockDb.insert.mockReturnThis();
      mockDb.values.mockResolvedValue(undefined);
    });

    it('should update story successfully', async () => {
      const result = await service.updateStory(1, {
        title: 'Updated Title',
        label: 'verified',
      });

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('message', 'Story updated successfully');
    });

    it('should throw NotFoundException for non-existent story', async () => {
      mockDb.where = jest.fn().mockResolvedValue([]);

      await expect(
        service.updateStory(999, { title: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should only update provided fields', async () => {
      await service.updateStory(1, { label: 'verified' });

      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'verified',
          updatedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('deleteStory', () => {
    beforeEach(() => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValueOnce([{ id: 1 }]);
      mockDb.delete.mockReturnThis();
      mockDb.execute = jest.fn().mockResolvedValue(undefined);
    });

    it('should delete story and related data', async () => {
      const result = await service.deleteStory(1);

      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('message', 'Story deleted successfully');
      expect(mockDb.delete).toHaveBeenCalledTimes(5); // events, claims, evidence, story_items, story
    });

    it('should throw NotFoundException for non-existent story', async () => {
      mockDb.where = jest.fn().mockResolvedValue([]);

      await expect(service.deleteStory(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSources', () => {
    it('should return all sources with counts', async () => {
      const mockSources = [
        { id: 1, name: 'Hacker News', type: 'hackernews', isActive: true },
        { id: 2, name: 'Reddit', type: 'reddit', isActive: true },
      ];

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.orderBy = jest.fn().mockResolvedValue(mockSources);
      mockDb.groupBy = jest.fn().mockResolvedValue([
        { sourceId: 'hackernews', count: 50 },
        { sourceId: 'reddit', count: 30 },
      ]);

      const result = await service.getSources();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('itemsCount');
    });
  });

  describe('updateSource', () => {
    it('should update source status', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValueOnce([{ id: 1, name: 'HN' }]);
      mockDb.update.mockReturnThis();
      mockDb.set.mockReturnThis();

      const result = await service.updateSource(1, { isActive: false });

      expect(result).toHaveProperty('id', 1);
      expect(mockDb.set).toHaveBeenCalledWith({ isActive: false });
    });

    it('should throw NotFoundException for non-existent source', async () => {
      mockDb.where = jest.fn().mockResolvedValue([]);

      await expect(
        service.updateSource(999, { isActive: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status of all services', async () => {
      const result = await service.getHealthStatus();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('services');
      expect(result.services).toHaveProperty('api');
      expect(result.services).toHaveProperty('database');
      expect(result.services).toHaveProperty('redis');
    });

    it('should mark services as healthy when responsive', async () => {
      mockDb.execute = jest.fn().mockResolvedValue(undefined);

      const result = await service.getHealthStatus();

      expect(result.services.api).toBe('healthy');
      expect(result.services.database).toBe('healthy');
      expect(result.services.redis).toBe('healthy');
    });
  });

  describe('refreshThumbnail', () => {
    it('should queue thumbnail refresh', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.innerJoin = jest.fn().mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValue([{ itemUrl: 'https://example.com' }]);

      const result = await service.refreshThumbnail(1);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('jobId');
      expect(mockRedis.setJSON).toHaveBeenCalled();
    });

    it('should use custom URL if provided', async () => {
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where = jest.fn().mockResolvedValue([{ id: 1 }]);

      await service.refreshThumbnail(1, 'https://custom.com/image.jpg');

      expect(mockRedis.setJSON).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ url: 'https://custom.com/image.jpg' }),
        expect.any(Number),
      );
    });

    it('should throw NotFoundException for non-existent story', async () => {
      mockDb.where = jest.fn().mockResolvedValue([]);

      await expect(service.refreshThumbnail(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
