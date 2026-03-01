import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ScoringService } from '../scoring.service';
import { MockScoringService } from '../mock-scoring.service';
import { ScoringService as AiScoringService } from '../../ai/scoring.service';

describe('ScoringService', () => {
  let service: ScoringService;
  let mockDb: any;
  let mockConfigService: any;
  let mockMockScoringService: any;
  let mockAiScoringService: any;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
      execute: jest.fn(),
      transaction: jest.fn((fn) => fn(mockDb)),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'app.mockMode': false,
          'USE_LOCAL_AI': false,
        };
        return config[key];
      }),
    };

    mockMockScoringService = {
      score: jest.fn().mockResolvedValue({
        label: 'verified',
        confidence: 0.9,
        summary: 'Mock score',
        reasons: ['Test'],
        claims: [],
        evidence: [],
      }),
    };

    mockAiScoringService = {
      scoreStory: jest.fn().mockResolvedValue({
        label: 'verified',
        confidence: 0.85,
        summary: 'AI scored',
        reasons: ['Good sources'],
        keyClaims: [{ text: 'Claim 1', status: 'verified', sources: [] }],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MockScoringService,
          useValue: mockMockScoringService,
        },
        {
          provide: AiScoringService,
          useValue: mockAiScoringService,
        },
        {
          provide: 'DATABASE_CLIENT',
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreStory', () => {
    const mockStory = {
      id: '1',
      title: 'Test Story',
      canonicalUrl: 'https://example.com/test',
      itemCount: 2,
      sources: ['hackernews'],
    };

    beforeEach(() => {
      mockDb.query.mockResolvedValue([mockStory]);
      mockDb.execute.mockResolvedValue(undefined);
    });

    it('should use mock scoring when mockMode is true', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'app.mockMode') return true;
        return false;
      });

      const result = await service.scoreStory('1');

      expect(mockMockScoringService.score).toHaveBeenCalled();
      expect(result).toHaveProperty('label');
    });

    it('should use AI scoring when USE_LOCAL_AI is true', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'USE_LOCAL_AI') return true;
        if (key === 'app.mockMode') return false;
        return null;
      });

      const result = await service.scoreStory('1');

      expect(mockAiScoringService.scoreStory).toHaveBeenCalled();
      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('confidence');
    });

    it('should fallback to rule-based scoring when AI fails', async () => {
      mockConfigService.get = jest.fn((key: string) => {
        if (key === 'USE_LOCAL_AI') return true;
        if (key === 'app.mockMode') return false;
        return null;
      });

      mockAiScoringService.scoreStory.mockRejectedValue(new Error('AI Error'));

      const result = await service.scoreStory('1');

      expect(result).toHaveProperty('label');
      expect(result.summary).toContain('Rule-based');
    });

    it('should use rule-based scoring by default', async () => {
      mockConfigService.get = jest.fn(() => false);

      const result = await service.scoreStory('1');

      expect(result).toHaveProperty('label');
      expect(result).toHaveProperty('summary');
    });

    it('should throw error if story not found', async () => {
      mockDb.query.mockResolvedValue([]);

      await expect(service.scoreStory('999')).rejects.toThrow('Story 999 not found');
    });

    it('should persist score to database', async () => {
      await service.scoreStory('1');

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should write story event', async () => {
      await service.scoreStory('1');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('story_events'),
        expect.any(Array),
      );
    });
  });

  describe('ruleBasedScoring', () => {
    it('should score higher for trusted sources', async () => {
      mockConfigService.get = jest.fn(() => false);
      
      const trustedStory = {
        id: '1',
        title: 'Test',
        canonicalUrl: 'https://reuters.com/article',
        itemCount: 1,
        sources: ['reuters.com'],
      };

      mockDb.query.mockResolvedValue([trustedStory]);

      const result = await service.scoreStory('1');

      expect(result.label).toBe('likely');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should score higher for multiple sources', async () => {
      mockConfigService.get = jest.fn(() => false);
      
      const multiSourceStory = {
        id: '1',
        title: 'Test',
        canonicalUrl: 'https://example.com',
        itemCount: 3,
        sources: ['hackernews', 'reddit', 'twitter'],
      };

      mockDb.query.mockResolvedValue([multiSourceStory]);

      const result = await service.scoreStory('1');

      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should mark unverified for unknown sources', async () => {
      mockConfigService.get = jest.fn(() => false);
      
      const unknownStory = {
        id: '1',
        title: 'Test',
        canonicalUrl: 'https://unknown-blog.com',
        itemCount: 1,
        sources: ['unknown'],
      };

      mockDb.query.mockResolvedValue([unknownStory]);

      const result = await service.scoreStory('1');

      expect(result.label).toBe('unverified');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('DB Connection Error'));

      // Should return mock story for testing and continue
      const result = await service.scoreStory('1');
      
      expect(result).toBeDefined();
    });

    it('should handle transaction errors', async () => {
      mockDb.query.mockResolvedValue([{
        id: '1',
        title: 'Test',
        canonicalUrl: 'https://example.com',
        itemCount: 1,
        sources: ['hackernews'],
      }]);
      
      mockDb.transaction.mockRejectedValue(new Error('Transaction Error'));

      await expect(service.scoreStory('1')).rejects.toThrow();
    });
  });
});
