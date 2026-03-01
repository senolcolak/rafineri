import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, sql, desc, isNull, or, lt, and } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { RedisService } from '@/database/redis.service';
import { stories, claims, storyEvents, items, storyItems } from '@/database/schema';

interface RescoreResult {
  id: number;
  title: string;
  label: string;
  confidence: number;
  hotScore: number;
  verificationScore: number;
  controversyScore: number;
  previousScores: {
    hotScore: number;
    verificationScore: number;
    controversyScore: number;
  };
  message: string;
}

interface ThumbnailRefreshResult {
  success: boolean;
  message: string;
  jobId?: string;
}

interface BulkThumbnailRefreshResult {
  success: boolean;
  message: string;
  queued: number;
}

interface StoryWithUrl {
  id: number;
  thumbnailUrl: string | null;
  lastThumbnailRefresh: Date | null;
  itemUrl: string;
}

@Injectable()
export class AdminService {
  private readonly placeholderPatterns = [
    'placeholder',
    'via.placeholder.com',
    'placehold.co',
    'dummyimage.com',
  ];

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: Database,
    private readonly redisService: RedisService,
    private readonly logger: Logger,
  ) {}

  async rescoreStory(id: number): Promise<RescoreResult> {
    try {
      // Get current story
      const storyResults = await this.db
        .select({
          id: stories.id,
          title: stories.title,
          label: stories.label,
          confidence: stories.confidence,
          hotScore: stories.hotScore,
          verificationScore: stories.verificationScore,
          controversyScore: stories.controversyScore,
        })
        .from(stories)
        .where(eq(stories.id, id))
        .limit(1);

      if (storyResults.length === 0) {
        throw new NotFoundException(`Story not found: ${id}`);
      }

      const story = storyResults[0];
      const previousScores = {
        hotScore: story.hotScore,
        verificationScore: story.verificationScore,
        controversyScore: story.controversyScore,
      };

      // Get claim statistics for this story
      const claimStats = await this.db
        .select({
          totalClaims: sql<number>`count(*)::int`,
          verifiedCount: sql<number>`count(*) filter (where ${claims.status} = 'verified')::int`,
          disputedCount: sql<number>`count(*) filter (where ${claims.status} = 'disputed')::int`,
          debunkedCount: sql<number>`count(*) filter (where ${claims.status} = 'debunked')::int`,
        })
        .from(claims)
        .where(eq(claims.storyId, story.id));

      const stats = claimStats[0] || {
        totalClaims: 0,
        verifiedCount: 0,
        disputedCount: 0,
        debunkedCount: 0,
      };

      // Calculate new scores
      const newScores = this.calculateScores(stats, story.id);
      
      // Calculate new label based on claims
      const newLabel = this.calculateLabel(stats);
      const newConfidence = this.calculateConfidence(stats);

      // Update story with new scores
      await this.db
        .update(stories)
        .set({
          label: newLabel,
          confidence: newConfidence,
          hotScore: newScores.hotScore,
          verificationScore: newScores.verificationScore,
          controversyScore: newScores.controversyScore,
          claimsCount: stats.totalClaims,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, story.id));

      // Clear caches related to this story
      await this.clearStoryCaches(story.id);

      // Log the event
      await this.db.insert(storyEvents).values({
        storyId: story.id,
        eventType: 'score_updated',
        data: {
          previousScores,
          newScores,
          previousLabel: story.label,
          newLabel,
          previousConfidence: story.confidence,
          newConfidence,
          triggeredBy: 'admin_rescore',
        },
      });

      this.logger.info(
        {
          storyId: story.id,
          previousScores,
          newScores,
          previousLabel: story.label,
          newLabel,
        },
        'Story rescored successfully',
      );

      return {
        id: story.id,
        title: story.title,
        label: newLabel,
        confidence: newConfidence,
        hotScore: newScores.hotScore,
        verificationScore: newScores.verificationScore,
        controversyScore: newScores.controversyScore,
        previousScores,
        message: 'Story scores recalculated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        { err: error, storyId: id },
        'Failed to rescore story',
      );
      throw new InternalServerErrorException('Failed to rescore story');
    }
  }

  async refreshThumbnail(storyId: number, overrideUrl?: string): Promise<ThumbnailRefreshResult> {
    try {
      // Verify story exists and get its URL if not provided
      let url = overrideUrl;
      
      if (!url) {
        const result = await this.db
          .select({
            itemUrl: items.url,
          })
          .from(stories)
          .innerJoin(storyItems, eq(storyItems.storyId, stories.id))
          .innerJoin(items, eq(items.id, storyItems.itemId))
          .where(eq(stories.id, storyId))
          .limit(1);

        if (result.length === 0) {
          throw new NotFoundException(`Story not found: ${storyId}`);
        }

        url = result[0].itemUrl;
      } else {
        // Just verify story exists
        const storyResult = await this.db
          .select({ id: stories.id })
          .from(stories)
          .where(eq(stories.id, storyId))
          .limit(1);

        if (storyResult.length === 0) {
          throw new NotFoundException(`Story not found: ${storyId}`);
        }
      }

      // Create a job ID for tracking
      const jobId = `thumbnail-refresh:${storyId}:admin:${Date.now()}`;

      // Store the refresh request in Redis for the worker to pick up
      // The worker will listen for this key pattern
      await this.redisService.setJSON(
        `admin:thumbnail:refresh:${storyId}`,
        {
          storyId: storyId.toString(),
          url,
          jobId,
          requestedAt: new Date().toISOString(),
        },
        300 // 5 minute TTL
      );

      // Publish event to notify workers
      await this.redisService.getClient().publish(
        'admin:thumbnail:refresh',
        JSON.stringify({
          storyId: storyId.toString(),
          url,
          jobId,
        })
      );

      this.logger.info(
        { storyId, url, jobId },
        'Thumbnail refresh queued successfully',
      );

      return {
        success: true,
        message: 'Thumbnail refresh queued successfully',
        jobId,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        { err: error, storyId, url: overrideUrl },
        'Failed to queue thumbnail refresh',
      );
      throw new InternalServerErrorException('Failed to queue thumbnail refresh');
    }
  }

  async refreshAllThumbnails(limit: number = 100, force: boolean = false): Promise<BulkThumbnailRefreshResult> {
    try {
      const refreshThreshold = new Date();
      refreshThreshold.setHours(refreshThreshold.getHours() - 24);

      // Build where conditions
      const whereConditions = force 
        ? [] 
        : [
            or(
              isNull(stories.lastThumbnailRefresh),
              lt(stories.lastThumbnailRefresh, refreshThreshold),
              this.buildPlaceholderCondition()
            )!
          ];

      // Query top trending stories
      const results = await this.db
        .select({
          id: stories.id,
          thumbnailUrl: stories.thumbnailUrl,
          lastThumbnailRefresh: stories.lastThumbnailRefresh,
          itemUrl: items.url,
        })
        .from(stories)
        .innerJoin(storyItems, eq(storyItems.storyId, stories.id))
        .innerJoin(items, eq(items.id, storyItems.itemId))
        .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
        .orderBy(desc(stories.hotScore))
        .limit(limit);

      // Deduplicate by story ID
      const seenIds = new Set<number>();
      const uniqueResults: StoryWithUrl[] = [];
      
      for (const story of results) {
        if (!seenIds.has(story.id)) {
          seenIds.add(story.id);
          uniqueResults.push(story);
        }
      }

      // Queue refreshes for each story
      let queuedCount = 0;
      const batchJobId = `thumbnail-refresh:bulk:${Date.now()}`;

      for (const story of uniqueResults) {
        const jobId = `${batchJobId}:${story.id}`;
        
        await this.redisService.setJSON(
          `admin:thumbnail:refresh:${story.id}`,
          {
            storyId: story.id.toString(),
            url: story.itemUrl,
            jobId,
            requestedAt: new Date().toISOString(),
          },
          300
        );
        
        queuedCount++;
      }

      // Publish batch event
      await this.redisService.getClient().publish(
        'admin:thumbnail:refresh:bulk',
        JSON.stringify({
          count: queuedCount,
          batchJobId,
          storyIds: uniqueResults.map(s => s.id),
        })
      );

      this.logger.info(
        { queued: queuedCount, limit, force },
        'Bulk thumbnail refresh queued successfully',
      );

      return {
        success: true,
        message: `Queued ${queuedCount} thumbnail refreshes`,
        queued: queuedCount,
      };
    } catch (error) {
      this.logger.error(
        { err: error, limit, force },
        'Failed to queue bulk thumbnail refresh',
      );
      throw new InternalServerErrorException('Failed to queue thumbnail refreshes');
    }
  }

  private buildPlaceholderCondition() {
    const conditions = this.placeholderPatterns.map((pattern) =>
      sql`${stories.thumbnailUrl} ILIKE ${`%${pattern}%`}`
    );
    
    if (conditions.length === 0) {
      return sql`FALSE`;
    }
    
    return conditions.reduce((acc, condition, index) => {
      if (index === 0) return condition;
      return sql`${acc} OR ${condition}`;
    });
  }

  private calculateScores(
    stats: {
      totalClaims: number;
      verifiedCount: number;
      disputedCount: number;
      debunkedCount: number;
    },
    storyId: number,
  ): {
    hotScore: number;
    verificationScore: number;
    controversyScore: number;
  } {
    // Hot score: combination of recency, activity, and engagement
    const baseHotScore = stats.totalClaims * 10;
    
    // Verification score: based on verified claims
    const verificationScore = Math.min(100, stats.verifiedCount * 20);

    // Controversy score: based on disputed and debunked claims
    const controversyScore = Math.min(100, (stats.disputedCount + stats.debunkedCount) * 30);

    // Hot score incorporates all factors
    const hotScore = Math.round(
      baseHotScore + verificationScore * 0.5 + controversyScore * 0.3,
    );

    return {
      hotScore: Math.max(0, hotScore),
      verificationScore: Math.max(0, verificationScore),
      controversyScore: Math.max(0, controversyScore),
    };
  }

  private calculateLabel(stats: {
    totalClaims: number;
    verifiedCount: number;
    disputedCount: number;
    debunkedCount: number;
  }): 'verified' | 'likely' | 'contested' | 'unverified' {
    if (stats.debunkedCount > 0) {
      return 'contested';
    }
    if (stats.disputedCount > 0 && stats.verifiedCount === 0) {
      return 'contested';
    }
    if (stats.verifiedCount >= 2) {
      return 'verified';
    }
    if (stats.verifiedCount === 1) {
      return 'likely';
    }
    return 'unverified';
  }

  private calculateConfidence(stats: {
    totalClaims: number;
    verifiedCount: number;
    disputedCount: number;
    debunkedCount: number;
  }): number {
    if (stats.totalClaims === 0) {
      return 0;
    }
    const score = (stats.verifiedCount * 0.4 - stats.disputedCount * 0.3 - stats.debunkedCount * 0.5) / Math.max(1, stats.totalClaims);
    return Math.min(1, Math.max(0, score + 0.5));
  }

  private async clearStoryCaches(storyId: number): Promise<void> {
    try {
      // Clear specific story cache
      await this.redisService.del(`story:${storyId}`);

      // Clear trending caches
      await this.redisService.deletePattern('trending:*');

      this.logger.debug({ storyId }, 'Story caches cleared');
    } catch (error) {
      this.logger.warn({ err: error, storyId }, 'Failed to clear story caches');
    }
  }
}
