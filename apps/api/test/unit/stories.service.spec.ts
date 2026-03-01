import { Test, TestingModule } from '@nestjs/testing';
import { StoriesService } from '../../src/stories/stories.service';
import { DRIZZLE_PROVIDER } from '../../src/database/database.module';
import { NotFoundException } from '@nestjs/common';

describe('StoriesService', () => {
  let service: StoriesService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoriesService,
        {
          provide: DRIZZLE_PROVIDER,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<StoriesService>(StoriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrending', () => {
    const mockStories = [
      {
        id: 1,
        title: 'Test Story 1',
        label: 'verified',
        hotScore: 95,
        confidence: 0.92,
      },
      {
        id: 2,
        title: 'Test Story 2',
        label: 'likely',
        hotScore: 80,
        confidence: 0.75,
      },
    ];

    it('should return trending stories with default sorting', async () => {
      mockDb.query.mockResolvedValue(mockStories);

      const result = await service.getTrending({
        sort: 'hot',
        page: 1,
        limit: 20,
      });

      expect(result).toHaveProperty('stories');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(Array.isArray(result.stories)).toBe(true);
    });

    it('should filter by label', async () => {
      mockDb.query.mockResolvedValue([mockStories[0]]);

      const result = await service.getTrending({
        sort: 'hot',
        label: 'verified',
        page: 1,
        limit: 20,
      });

      expect(result.stories[0].label).toBe('verified');
    });

    it('should filter by category', async () => {
      mockDb.query.mockResolvedValue(mockStories);

      await service.getTrending({
        sort: 'hot',
        category: 'technology',
        page: 1,
        limit: 20,
      });

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle search query', async () => {
      mockDb.query.mockResolvedValue([mockStories[0]]);

      const result = await service.getTrending({
        sort: 'hot',
        q: 'test',
        page: 1,
        limit: 20,
      });

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should support different sort options', async () => {
      const sorts = ['hot', 'most_verified', 'most_contested', 'newest'];

      for (const sort of sorts) {
        mockDb.query.mockResolvedValue(mockStories);

        const result = await service.getTrending({
          sort: sort as any,
          page: 1,
          limit: 20,
        });

        expect(result).toHaveProperty('stories');
      }
    });

    it('should enforce max limit of 100', async () => {
      mockDb.query.mockResolvedValue([]);

      await service.getTrending({
        sort: 'hot',
        page: 1,
        limit: 200, // Try to request more than max
      });

      // Should be limited to 100 in the query
      expect(mockDb.limit).toHaveBeenCalledWith(100);
    });
  });

  describe('getStory', () => {
    const mockStory = {
      id: 1,
      title: 'Test Story',
      summary: 'Test summary',
      label: 'verified',
      confidence: 0.92,
    };

    it('should return story by id', async () => {
      mockDb.query.mockResolvedValue([mockStory]);

      const result = await service.getStory(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.title).toBe('Test Story');
    });

    it('should throw NotFoundException for non-existent story', async () => {
      mockDb.query.mockResolvedValue([]);

      await expect(service.getStory(999)).rejects.toThrow(NotFoundException);
    });

    it('should include related items', async () => {
      const storyWithItems = {
        ...mockStory,
        items: [
          { id: 1, title: 'Item 1', source: 'hackernews' },
          { id: 2, title: 'Item 2', source: 'reddit' },
        ],
      };

      mockDb.query.mockResolvedValue([storyWithItems]);

      const result = await service.getStory(1);

      expect(result).toHaveProperty('items');
      expect(Array.isArray(result.items)).toBe(true);
    });
  });

  describe('getCategories', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        { name: 'Technology', count: 50 },
        { name: 'Science', count: 30 },
        { name: 'Politics', count: 20 },
      ];

      mockDb.query.mockResolvedValue(mockCategories);

      const result = await service.getCategories();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('count');
    });

    it('should return empty array if no categories', async () => {
      mockDb.query.mockResolvedValue([]);

      const result = await service.getCategories();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('getStoryClaims', () => {
    const mockClaims = [
      { id: 1, text: 'Claim 1', status: 'verified', confidence: 0.9 },
      { id: 2, text: 'Claim 2', status: 'pending', confidence: 0.5 },
    ];

    it('should return claims for a story', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1 }]) // Story exists
        .mockResolvedValueOnce(mockClaims); // Claims

      const result = await service.getStoryClaims(1, 1, 20);

      expect(result).toHaveProperty('claims');
      expect(Array.isArray(result.claims)).toBe(true);
      expect(result.claims.length).toBe(2);
    });

    it('should throw NotFoundException if story does not exist', async () => {
      mockDb.query.mockResolvedValue([]); // Story not found

      await expect(service.getStoryClaims(999, 1, 20)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle pagination', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce(mockClaims);

      const result = await service.getStoryClaims(1, 2, 10);

      expect(result).toHaveProperty('page', 2);
      expect(result).toHaveProperty('limit', 10);
    });
  });

  describe('getStoryEvidence', () => {
    const mockEvidence = [
      { id: 1, url: 'https://source1.com', title: 'Source 1', stance: 'supporting' },
      { id: 2, url: 'https://source2.com', title: 'Source 2', stance: 'neutral' },
    ];

    it('should return evidence for a story', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce(mockEvidence);

      const result = await service.getStoryEvidence(1, 1, 20);

      expect(result).toHaveProperty('evidence');
      expect(Array.isArray(result.evidence)).toBe(true);
    });

    it('should throw NotFoundException if story does not exist', async () => {
      mockDb.query.mockResolvedValue([]);

      await expect(service.getStoryEvidence(999, 1, 20)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStoryEvents', () => {
    const mockEvents = [
      { id: 1, eventType: 'story_created', createdAt: new Date() },
      { id: 2, eventType: 'item_added', createdAt: new Date() },
    ];

    it('should return events for a story', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce(mockEvents);

      const result = await service.getStoryEvents(1, 1, 20);

      expect(result).toHaveProperty('events');
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('should order events by date descending', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce(mockEvents);

      await service.getStoryEvents(1, 1, 20);

      expect(mockDb.orderBy).toHaveBeenCalled();
    });
  });
});
