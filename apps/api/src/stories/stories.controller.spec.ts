import { Test, TestingModule } from '@nestjs/testing';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { Logger } from 'nestjs-pino';

describe('StoriesController', () => {
  let controller: StoriesController;

  const mockStoriesService = {
    getTrending: jest.fn(),
    getCategories: jest.fn(),
    getStory: jest.fn(),
    getStoryClaims: jest.fn(),
    getStoryEvidence: jest.fn(),
    getStoryEvents: jest.fn(),
  };

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoriesController],
      providers: [
        {
          provide: StoriesService,
          useValue: mockStoriesService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<StoriesController>(StoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getTrending', () => {
    it('should return trending stories with default params', async () => {
      const mockResult = {
        stories: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      mockStoriesService.getTrending.mockResolvedValue(mockResult);

      const result = await controller.getTrending('hot');

      expect(result).toEqual(mockResult);
      expect(mockStoriesService.getTrending).toHaveBeenCalledWith({
        sort: 'hot',
        category: undefined,
        label: undefined,
        q: undefined,
        page: 1,
        limit: 20,
      });
    });
  });

  describe('getCategories', () => {
    it('should return categories', async () => {
      const mockCategories = [
        { id: 1, slug: 'politics', name: 'Politics', storyCount: 10 },
      ];
      mockStoriesService.getCategories.mockResolvedValue(mockCategories);

      const result = await controller.getCategories();

      expect(result).toEqual(mockCategories);
    });
  });
});
