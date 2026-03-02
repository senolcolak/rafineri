import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Inject } from '@nestjs/common';
import { eq, sql, desc, and, isNull, or, lt } from 'drizzle-orm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { stories, items, storyItems } from '../database/schema';
import { QUEUE_NAMES } from '../queues/queue-names';
import { DATABASE_PROVIDER, Database } from '../config/database.module';
import { RedisService } from '../config/redis.service';

interface StoryWithUrl {
  id: number;
  thumbnailUrl: string | null;
  lastThumbnailRefresh: Date | null;
  itemUrl: string;
}

@Injectable()
export class ThumbnailRefreshScheduler {
  private readonly logger = new Logger(ThumbnailRefreshScheduler.name);
  private readonly placeholderPatterns: string[];
  private readonly refreshIntervalHours: number;
  private readonly topStoriesLimit: number;
  private readonly domainThrottleMinutes: number;

  constructor(
    @Inject(DATABASE_PROVIDER) private readonly db: Database,
    @InjectQueue(QUEUE_NAMES.THUMBNAIL_REFRESH) private readonly thumbnailQueue: Queue,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // Load configuration with defaults
    this.placeholderPatterns = this.configService.get<string[]>(
      'app.thumbnail.placeholderPatterns',
      [
        'placeholder',
        'via.placeholder.com',
        'placehold.co',
        'dummyimage.com',
      ],
    );
    this.refreshIntervalHours = this.configService.get<number>(
      'app.thumbnail.refreshIntervalHours',
      24,
    );
    this.topStoriesLimit = this.configService.get<number>(
      'app.thumbnail.topStoriesLimit',
      100,
    );
    this.domainThrottleMinutes = this.configService.get<number>(
      'app.thumbnail.domainThrottleMinutes',
      60,
    );
  }

  /**
   * Run every hour to check and queue thumbnail refreshes for trending stories
   * Cron expression: 0 * * * * (at the start of every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleThumbnailRefreshes(): Promise<void> {
    this.logger.log('Starting scheduled thumbnail refresh check for trending stories');
    
    try {
      const storiesNeedingRefresh = await this.findStoriesNeedingRefresh();
      this.logger.log(`Found ${storiesNeedingRefresh.length} stories potentially needing thumbnail refresh`);

      let queuedCount = 0;
      let skippedCount = 0;

      for (const story of storiesNeedingRefresh) {
        const shouldRefresh = await this.shouldRefreshThumbnail(story);
        
        if (!shouldRefresh) {
          skippedCount++;
          continue;
        }

        // Check domain throttle
        const domain = this.extractDomain(story.itemUrl);
        if (await this.isDomainThrottled(domain)) {
          this.logger.debug(
            `Skipping story ${story.id} - domain ${domain} is throttled`
          );
          skippedCount++;
          continue;
        }

        // Queue the refresh job
        try {
          await this.thumbnailQueue.add(
            'refresh-thumbnail',
            {
              storyId: story.id.toString(),
              url: story.itemUrl,
            },
            {
              jobId: `thumbnail-refresh:${story.id}:${Date.now()}`,
              priority: this.calculatePriority(story),
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            }
          );

          // Record domain throttle
          await this.recordDomainRefresh(domain);
          
          queuedCount++;
          this.logger.debug(`Queued thumbnail refresh for story ${story.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to queue thumbnail refresh for story ${story.id}:`,
            error
          );
        }
      }

      this.logger.log(
        `Thumbnail refresh scheduling complete: ${queuedCount} queued, ${skippedCount} skipped`
      );
    } catch (error) {
      this.logger.error('Failed to schedule thumbnail refreshes:', error);
    }
  }

  /**
   * Find top trending stories that might need thumbnail refresh
   */
  private async findStoriesNeedingRefresh(): Promise<StoryWithUrl[]> {
    const refreshThreshold = new Date();
    refreshThreshold.setHours(refreshThreshold.getHours() - this.refreshIntervalHours);

    // Build placeholder condition
    const placeholderConditions = this.placeholderPatterns.map((pattern) =>
      sql`${stories.thumbnailUrl} ILIKE ${`%${pattern}%`}`
    );
    
    const placeholderCondition = placeholderConditions.length > 0
      ? placeholderConditions.reduce((acc, condition, index) => {
          if (index === 0) return condition;
          return sql`${acc} OR ${condition}`;
        })
      : sql`FALSE`;

    // Query top trending stories with their primary item URL
    const results = await this.db
      .select({
        id: stories.id,
        thumbnailUrl: stories.thumbnailUrl,
        lastThumbnailRefresh: stories.lastThumbnailRefresh,
        itemUrl: items.url,
      })
      .from(stories)
      .innerJoin(
        storyItems,
        eq(storyItems.storyId, stories.id)
      )
      .innerJoin(
        items,
        eq(items.id, storyItems.itemId)
      )
      .where(
        or(
          // Never refreshed
          isNull(stories.lastThumbnailRefresh),
          // Last refresh is older than threshold
          lt(stories.lastThumbnailRefresh, refreshThreshold),
          // Has placeholder thumbnail
          placeholderCondition
        )
      )
      .orderBy(desc(stories.hotScore))
      .limit(this.topStoriesLimit);

    // Deduplicate by story ID (keep first item URL for each story)
    const seenIds = new Set<number>();
    return results.filter((story) => {
      if (seenIds.has(story.id)) {
        return false;
      }
      seenIds.add(story.id);
      return true;
    });
  }

  /**
   * Determine if a story's thumbnail should be refreshed
   */
  private async shouldRefreshThumbnail(story: StoryWithUrl): Promise<boolean> {
    // Check if thumbnail is a placeholder
    if (this.isPlaceholderThumbnail(story.thumbnailUrl)) {
      this.logger.debug(`Story ${story.id} has placeholder thumbnail, needs refresh`);
      return true;
    }

    // Check if last refresh is older than 24 hours
    if (!story.lastThumbnailRefresh) {
      this.logger.debug(`Story ${story.id} has never been refreshed`);
      return true;
    }

    const hoursSinceRefresh =
      (Date.now() - new Date(story.lastThumbnailRefresh).getTime()) /
      (1000 * 60 * 60);

    if (hoursSinceRefresh >= this.refreshIntervalHours) {
      this.logger.debug(
        `Story ${story.id} thumbnail is ${Math.round(hoursSinceRefresh)} hours old`
      );
      return true;
    }

    return false;
  }

  /**
   * Check if thumbnail URL is a placeholder
   */
  private isPlaceholderThumbnail(thumbnailUrl: string | null): boolean {
    if (!thumbnailUrl) return true;
    
    return this.placeholderPatterns.some((pattern) =>
      thumbnailUrl.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Extract domain from URL for throttling
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Check if domain has been refreshed too recently
   */
  private async isDomainThrottled(domain: string): Promise<boolean> {
    const throttleKey = `thumbnail:domain:${domain}`;
    const lastRefresh = await this.redisService.get(throttleKey);
    
    if (!lastRefresh) {
      return false;
    }

    const lastRefreshTime = parseInt(lastRefresh, 10);
    const minutesSinceRefresh = (Date.now() - lastRefreshTime) / (1000 * 60);
    
    return minutesSinceRefresh < this.domainThrottleMinutes;
  }

  /**
   * Record that a domain has been refreshed
   */
  private async recordDomainRefresh(domain: string): Promise<void> {
    const throttleKey = `thumbnail:domain:${domain}`;
    const ttlSeconds = this.domainThrottleMinutes * 60;
    
    await this.redisService.set(throttleKey, Date.now().toString(), ttlSeconds);
  }

  /**
   * Calculate job priority based on story hot score
   */
  private calculatePriority(story: StoryWithUrl): number {
    // Higher hot score = higher priority (lower number in BullMQ)
    // Base priority is 50, subtract hot score influence
    return Math.max(1, 50 - Math.floor(story.id / 100));
  }

  /**
   * Manually trigger thumbnail refresh for a specific story
   * Can be called from admin API
   */
  async refreshStoryThumbnail(storyId: number, url: string): Promise<boolean> {
    try {
      await this.thumbnailQueue.add(
        'refresh-thumbnail',
        {
          storyId: storyId.toString(),
          url,
        },
        {
          jobId: `thumbnail-refresh:${storyId}:manual:${Date.now()}`,
          priority: 1, // High priority for manual triggers
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }
      );

      this.logger.log(`Manually queued thumbnail refresh for story ${storyId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to queue manual thumbnail refresh for story ${storyId}:`, error);
      return false;
    }
  }
}
