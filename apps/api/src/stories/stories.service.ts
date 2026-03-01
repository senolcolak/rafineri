import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, sql, desc, asc, and, or, ilike, SQL } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { RedisService } from '@/database/redis.service';
import {
  stories,
  claims,
  evidence,
  storyEvents,
  type Story,
} from '@/database/schema';
import {
  TrendingQueryDto,
  TrendingResponse,
  CategoryDto,
  StoryDetailDto,
  ClaimDto,
  EvidenceDto,
  EventDto,
  PaginatedResponse,
} from './dto/trending.dto';

@Injectable()
export class StoriesService {
  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: Database,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async getTrending(query: TrendingQueryDto): Promise<TrendingResponse> {
    const cacheKey = this.generateTrendingCacheKey(query);
    
    // Try to get from cache
    const cached = await this.redisService.getJSON<TrendingResponse>(cacheKey);
    if (cached) {
      this.logger.debug({ cacheKey }, 'Trending cache hit');
      return cached;
    }

    const { sort, label, q, page, limit } = query;
    const offset = (page - 1) * limit;

    try {
      // Build where conditions
      const whereConditions: SQL<unknown>[] = [];

      if (label) {
        whereConditions.push(
          eq(stories.label, label),
        );
      }

      if (q) {
        whereConditions.push(
          or(
            ilike(stories.title, `%${q}%`),
            ilike(stories.summary, `%${q}%`),
          )!,
        );
      }

      // Determine sort order
      let orderBy: SQL<unknown>;
      switch (sort) {
        case 'hot':
          orderBy = desc(stories.hotScore);
          break;
        case 'most_verified':
          orderBy = desc(stories.verificationScore);
          break;
        case 'most_contested':
          orderBy = desc(stories.controversyScore);
          break;
        case 'newest':
          orderBy = desc(stories.firstSeenAt);
          break;
        default:
          orderBy = desc(stories.hotScore);
      }

      // Get total count
      const countResult = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(stories)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

      const total = countResult[0]?.count || 0;

      // Get stories
      const results = await this.db
        .select({
          id: stories.id,
          title: stories.title,
          summary: stories.summary,
          label: stories.label,
          confidence: stories.confidence,
          thumbnailUrl: stories.thumbnailUrl,
          thumbnailSource: stories.thumbnailSource,
          isPlaceholder: stories.isPlaceholder,
          placeholderGradient: stories.placeholderGradient,
          hotScore: stories.hotScore,
          verificationScore: stories.verificationScore,
          controversyScore: stories.controversyScore,
          sourcesCount: stories.sourcesCount,
          evidenceCount: stories.evidenceCount,
          contradictionsCount: stories.contradictionsCount,
          claimsCount: stories.claimsCount,
          seenOn: stories.seenOn,
          firstSeenAt: stories.firstSeenAt,
          updatedAt: stories.updatedAt,
        })
        .from(stories)
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      // Convert integer isPlaceholder to boolean
      const storiesWithBoolean = results.map(story => ({
        ...story,
        isPlaceholder: story.isPlaceholder === 1,
      }));

      const response: TrendingResponse = {
        stories: storiesWithBoolean,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };

      // Cache the result
      const ttl = this.getTrendingCacheTtl(sort);
      await this.redisService.setJSON(cacheKey, response, ttl);
      this.logger.debug({ cacheKey, ttl }, 'Trending cached');

      return response;
    } catch (error) {
      this.logger.error({ err: error, query }, 'Failed to get trending stories');
      throw new InternalServerErrorException('Failed to fetch trending stories');
    }
  }

  async getCategories(): Promise<CategoryDto[]> {
    // Return default categories based on verifiability labels
    const categories: CategoryDto[] = [
      { id: 1, slug: 'technology', name: 'Technology', description: 'Tech news and updates', storyCount: 0 },
      { id: 2, slug: 'science', name: 'Science', description: 'Scientific discoveries', storyCount: 0 },
      { id: 3, slug: 'politics', name: 'Politics', description: 'Political news', storyCount: 0 },
      { id: 4, slug: 'business', name: 'Business', description: 'Business and finance', storyCount: 0 },
      { id: 5, slug: 'health', name: 'Health', description: 'Health and medicine', storyCount: 0 },
    ];

    try {
      // Get counts per label as categories
      const labelCounts = await this.db
        .select({
          label: stories.label,
          count: sql<number>`count(*)::int`,
        })
        .from(stories)
        .groupBy(stories.label);

      return categories;
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to get categories');
      return categories;
    }
  }

  async getStory(id: number): Promise<StoryDetailDto> {
    const cacheKey = `story:${id}`;

    // Try to get from cache
    const cached = await this.redisService.getJSON<StoryDetailDto>(cacheKey);
    if (cached) {
      this.logger.debug({ storyId: id }, 'Story cache hit');
      return cached;
    }

    try {
      const results = await this.db
        .select({
          id: stories.id,
          title: stories.title,
          summary: stories.summary,
          label: stories.label,
          confidence: stories.confidence,
          thumbnailUrl: stories.thumbnailUrl,
          thumbnailSource: stories.thumbnailSource,
          isPlaceholder: stories.isPlaceholder,
          placeholderGradient: stories.placeholderGradient,
          hotScore: stories.hotScore,
          verificationScore: stories.verificationScore,
          controversyScore: stories.controversyScore,
          sourcesCount: stories.sourcesCount,
          evidenceCount: stories.evidenceCount,
          contradictionsCount: stories.contradictionsCount,
          claimsCount: stories.claimsCount,
          seenOn: stories.seenOn,
          firstSeenAt: stories.firstSeenAt,
          updatedAt: stories.updatedAt,
          createdAt: stories.createdAt,
        })
        .from(stories)
        .where(eq(stories.id, id))
        .limit(1);

      if (results.length === 0) {
        throw new NotFoundException(`Story not found: ${id}`);
      }

      const story = results[0];

      // Cache the result
      const ttl = this.configService.get<number>('redis.cacheTtl.story', 300);
      await this.redisService.setJSON(cacheKey, story, ttl);

      return story;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error, storyId: id }, 'Failed to get story');
      throw new InternalServerErrorException('Failed to fetch story');
    }
  }

  async getStoryClaims(
    id: number,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<ClaimDto>> {
    // Verify story exists
    await this.getStory(id);
    const offset = (page - 1) * limit;

    try {
      const countResult = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(claims)
        .where(eq(claims.storyId, id));

      const total = countResult[0]?.count || 0;

      const results = await this.db
        .select({
          id: claims.id,
          text: claims.text,
          type: claims.type,
          status: claims.status,
          createdAt: claims.createdAt,
        })
        .from(claims)
        .where(eq(claims.storyId, id))
        .orderBy(desc(claims.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        data: results,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        { err: error, storyId: id },
        'Failed to get story claims',
      );
      throw new InternalServerErrorException('Failed to fetch claims');
    }
  }

  async getStoryEvidence(
    id: number,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<EvidenceDto>> {
    // Verify story exists
    await this.getStory(id);
    const offset = (page - 1) * limit;

    try {
      const countResult = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(evidence)
        .where(eq(evidence.storyId, id));

      const total = countResult[0]?.count || 0;

      const results = await this.db
        .select({
          id: evidence.id,
          url: evidence.url,
          title: evidence.title,
          stance: evidence.stance,
          snippet: evidence.snippet,
          createdAt: evidence.createdAt,
        })
        .from(evidence)
        .where(eq(evidence.storyId, id))
        .orderBy(desc(evidence.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        data: results,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        { err: error, storyId: id },
        'Failed to get story evidence',
      );
      throw new InternalServerErrorException('Failed to fetch evidence');
    }
  }

  async getStoryEvents(
    id: number,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<EventDto>> {
    // Verify story exists
    await this.getStory(id);
    const offset = (page - 1) * limit;

    try {
      const countResult = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(storyEvents)
        .where(eq(storyEvents.storyId, id));

      const total = countResult[0]?.count || 0;

      const results = await this.db
        .select({
          id: storyEvents.id,
          eventType: storyEvents.eventType,
          data: storyEvents.data,
          createdAt: storyEvents.createdAt,
        })
        .from(storyEvents)
        .where(eq(storyEvents.storyId, id))
        .orderBy(desc(storyEvents.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        data: results,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        { err: error, storyId: id },
        'Failed to get story events',
      );
      throw new InternalServerErrorException('Failed to fetch events');
    }
  }

  private generateTrendingCacheKey(query: TrendingQueryDto): string {
    const parts = [
      'trending',
      query.sort,
      query.category || 'all',
      query.label || 'all',
      query.q || 'all',
      query.page.toString(),
      query.limit.toString(),
    ];
    return parts.join(':');
  }

  private getTrendingCacheTtl(sort: string): number {
    const cacheTtl = this.configService.get<Record<string, number>>(
      'redis.cacheTtl.trending',
      {
        hot: 60,
        mostVerified: 120,
        mostContested: 120,
        newest: 60,
        default: 180,
      },
    );

    return cacheTtl[sort] || cacheTtl.default || 180;
  }
}
