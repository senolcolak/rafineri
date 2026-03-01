import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, sql, desc, isNull, or, lt, and, count } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { RedisService } from '@/database/redis.service';
import {
  stories,
  claims,
  storyEvents,
  items,
  storyItems,
  sources,
  evidence,
} from '@/database/schema';

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

interface DashboardStats {
  totalStories: number;
  storiesToday: number;
  pendingReview: number;
  totalSources: number;
  systemHealth: {
    api: 'healthy' | 'degraded' | 'down';
    worker: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
  };
  recentActivity: Array<{
    id: string;
    type: 'story_created' | 'story_updated' | 'ingestion';
    message: string;
    timestamp: string;
  }>;
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

  // ===== DASHBOARD =====

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get total stories count
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(stories);

      // Get stories created today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [todayResult] = await this.db
        .select({ count: count() })
        .from(stories)
        .where(sql`${stories.createdAt} >= ${today}`);

      // Get pending review (unverified stories)
      const [pendingResult] = await this.db
        .select({ count: count() })
        .from(stories)
        .where(eq(stories.label, 'unverified'));

      // Get total sources
      const [sourcesResult] = await this.db
        .select({ count: count() })
        .from(sources);

      // Get recent activity
      const recentEvents = await this.db
        .select({
          id: storyEvents.id,
          eventType: storyEvents.eventType,
          data: storyEvents.data,
          createdAt: storyEvents.createdAt,
        })
        .from(storyEvents)
        .orderBy(desc(storyEvents.createdAt))
        .limit(10);

      const activity = recentEvents.map((event) => ({
        id: event.id.toString(),
        type: this.mapEventType(event.eventType),
        message: this.formatEventMessage(event.eventType, event.data),
        timestamp: event.createdAt.toISOString(),
      }));

      return {
        totalStories: totalResult?.count || 0,
        storiesToday: todayResult?.count || 0,
        pendingReview: pendingResult?.count || 0,
        totalSources: sourcesResult?.count || 0,
        systemHealth: {
          api: 'healthy',
          worker: 'healthy',
          database: 'healthy',
        },
        recentActivity: activity,
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to get dashboard stats');
      throw new InternalServerErrorException('Failed to get dashboard stats');
    }
  }

  // ===== STORIES =====

  async getStories(params: {
    page: number;
    limit: number;
    q?: string;
    label?: string;
  }) {
    try {
      const { page, limit, q, label } = params;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions: any[] = [];
      
      if (q) {
        conditions.push(sql`${stories.title} ILIKE ${`%${q}%`}`);
      }
      
      if (label) {
        conditions.push(eq(stories.label, label as 'verified' | 'likely' | 'contested' | 'unverified'));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get stories
      const results = await this.db
        .select({
          id: stories.id,
          title: stories.title,
          summary: stories.summary,
          label: stories.label,
          category: sql<string>`COALESCE(${stories.seenOn}->>0, 'general')`,
          createdAt: stories.createdAt,
          updatedAt: stories.updatedAt,
        })
        .from(stories)
        .where(whereClause)
        .orderBy(desc(stories.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [countResult] = await this.db
        .select({ count: count() })
        .from(stories)
        .where(whereClause);

      const total = countResult?.count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        stories: results.map((s) => ({
          ...s,
          id: s.id.toString(),
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        })),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to get stories');
      throw new InternalServerErrorException('Failed to get stories');
    }
  }

  async updateStory(
    id: number,
    body: { title?: string; summary?: string; category?: string; label?: string },
  ) {
    try {
      // Check if story exists
      const [existing] = await this.db
        .select({ id: stories.id, title: stories.title })
        .from(stories)
        .where(eq(stories.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Story not found: ${id}`);
      }

      // Build update object
      const updateData: any = {
        updatedAt: new Date(),
      };

      if (body.title !== undefined) updateData.title = body.title;
      if (body.summary !== undefined) updateData.summary = body.summary;
      if (body.label !== undefined) updateData.label = body.label;
      // Note: category is not a direct field on stories table

      // Update story
      await this.db
        .update(stories)
        .set(updateData)
        .where(eq(stories.id, id));

      // Log the event
      await this.db.insert(storyEvents).values({
        storyId: id,
        eventType: 'label_changed',
        data: {
          updatedFields: Object.keys(body),
          previousTitle: existing.title,
          triggeredBy: 'admin_update',
        },
      });

      // Clear caches
      await this.clearStoryCaches(id);

      this.logger.log({ storyId: id }, 'Story updated successfully');

      return {
        id,
        message: 'Story updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error, storyId: id }, 'Failed to update story');
      throw new InternalServerErrorException('Failed to update story');
    }
  }

  async deleteStory(id: number) {
    try {
      // Check if story exists
      const [existing] = await this.db
        .select({ id: stories.id })
        .from(stories)
        .where(eq(stories.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Story not found: ${id}`);
      }

      // Delete related records first
      await this.db.delete(storyEvents).where(eq(storyEvents.storyId, id));
      await this.db.delete(claims).where(eq(claims.storyId, id));
      await this.db.delete(evidence).where(eq(evidence.storyId, id));
      await this.db.delete(storyItems).where(eq(storyItems.storyId, id));

      // Delete the story
      await this.db.delete(stories).where(eq(stories.id, id));

      // Clear caches
      await this.clearStoryCaches(id);

      this.logger.log({ storyId: id }, 'Story deleted successfully');

      return {
        id,
        message: 'Story deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error, storyId: id }, 'Failed to delete story');
      throw new InternalServerErrorException('Failed to delete story');
    }
  }

  async createStory(dto: { title: string; url: string; summary?: string; sourceName?: string }) {
    try {
      // Create the item first
      const externalId = `manual:${Date.now()}`;
      const [item] = await this.db
        .insert(items)
        .values({
          sourceType: 'manual',
          externalId,
          url: dto.url,
          canonicalUrl: dto.url,
          title: dto.title,
          content: dto.summary || null,
          author: 'admin',
          postedAt: new Date(),
          rawData: { sourceName: dto.sourceName || 'Manual' },
        })
        .returning({ id: items.id });

      // Create the story
      const [story] = await this.db
        .insert(stories)
        .values({
          title: dto.title,
          summary: dto.summary || null,
          canonicalUrl: dto.url,
          itemCount: 1,
        })
        .returning({ id: stories.id });

      // Link item to story
      await this.db.insert(storyItems).values({
        storyId: story.id,
        itemId: item.id,
      });

      // Log event
      await this.db.insert(storyEvents).values({
        storyId: story.id,
        eventType: 'story_created',
        data: {
          source: 'manual',
          url: dto.url,
          createdBy: 'admin',
        },
      });

      // Clear caches
      await this.clearStoryCaches(story.id);

      this.logger.log({ storyId: story.id }, 'Story created successfully');

      return {
        id: story.id,
        title: dto.title,
        message: 'Story created successfully',
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to create story');
      throw new InternalServerErrorException('Failed to create story');
    }
  }

  // ===== SOURCES =====

  async getSources() {
    try {
      const results = await this.db
        .select({
          id: sources.id,
          name: sources.name,
          type: sources.type,
          url: sources.url,
          isActive: sources.isActive,
          createdAt: sources.createdAt,
        })
        .from(sources)
        .orderBy(sources.name);

      // Get item counts for each source
      const counts = await this.db
        .select({
          sourceId: items.sourceType,
          count: count(),
        })
        .from(items)
        .groupBy(items.sourceType);

      const countMap = new Map(counts.map((c) => [c.sourceId, c.count]));

      return results.map((s) => ({
        ...s,
        id: s.id.toString(),
        itemsCount: countMap.get(s.type) || 0,
      }));
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to get sources');
      throw new InternalServerErrorException('Failed to get sources');
    }
  }

  async updateSource(
    id: number,
    body: { isActive?: boolean; config?: Record<string, unknown> },
  ) {
    try {
      // Check if source exists
      const [existing] = await this.db
        .select({ id: sources.id, name: sources.name })
        .from(sources)
        .where(eq(sources.id, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Source not found: ${id}`);
      }

      // Build update object
      const updateData: any = {};
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      // Update source
      await this.db
        .update(sources)
        .set(updateData)
        .where(eq(sources.id, id));

      this.logger.log(
        { sourceId: id, name: existing.name, isActive: body.isActive },
        'Source updated successfully',
      );

      return {
        id,
        message: 'Source updated successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error, sourceId: id }, 'Failed to update source');
      throw new InternalServerErrorException('Failed to update source');
    }
  }

  // ===== HEALTH & MONITORING =====

  async getHealthStatus() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy' as const,
        database: 'healthy' as const,
        redis: 'healthy' as const,
      },
      checks: {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
      },
    };

    return health;
  }

  private async checkDatabase() {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { status: 'healthy', responseTime: '< 10ms' };
    } catch (error) {
      return { status: 'unhealthy', error: 'Database connection failed' };
    }
  }

  private async checkRedis() {
    try {
      await this.redisService.getClient().ping();
      return { status: 'healthy', responseTime: '< 5ms' };
    } catch (error) {
      return { status: 'unhealthy', error: 'Redis connection failed' };
    }
  }

  async getLogs(lines: number) {
    // In a real implementation, this would read from log files
    // For now, return mock logs
    return [
      `[${new Date().toISOString()}] INFO: Server started`,
      `[${new Date().toISOString()}] INFO: Connected to database`,
      `[${new Date().toISOString()}] INFO: Worker initialized`,
    ];
  }

  async getMetrics() {
    // Prometheus-style metrics
    return `
# HELP rafineri_stories_total Total number of stories
# TYPE rafineri_stories_total gauge
rafineri_stories_total ${await this.getStoryCount()}

# HELP rafineri_items_ingested_total Total items ingested
# TYPE rafineri_items_ingested_total counter
rafineri_items_ingested_total ${await this.getItemCount()}
    `.trim();
  }

  private async getStoryCount() {
    const [result] = await this.db.select({ count: count() }).from(stories);
    return result?.count || 0;
  }

  private async getItemCount() {
    const [result] = await this.db.select({ count: count() }).from(items);
    return result?.count || 0;
  }

  // ===== EXISTING METHODS =====

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
        eventType: 'label_changed',
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

      this.logger.log(
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

      this.logger.log(
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

      this.logger.log(
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

  // ===== HELPER METHODS =====

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
    const baseHotScore = stats.totalClaims * 10;
    const verificationScore = Math.min(100, stats.verifiedCount * 20);
    const controversyScore = Math.min(100, (stats.disputedCount + stats.debunkedCount) * 30);
    const hotScore = Math.round(baseHotScore + verificationScore * 0.5 + controversyScore * 0.3);

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
      await this.redisService.del(`story:${storyId}`);
      await this.redisService.deletePattern('trending:*');
      this.logger.debug({ storyId }, 'Story caches cleared');
    } catch (error) {
      this.logger.warn({ err: error, storyId }, 'Failed to clear story caches');
    }
  }

  private mapEventType(eventType: string): 'story_created' | 'story_updated' | 'ingestion' {
    switch (eventType) {
      case 'story_created':
        return 'story_created';
      case 'label_changed':
      case 'score_updated':
        return 'story_updated';
      case 'item_added':
        return 'ingestion';
      default:
        return 'story_updated';
    }
  }

  private formatEventMessage(eventType: string, data: any): string {
    switch (eventType) {
      case 'story_created':
        return 'New story created';
      case 'label_changed':
        return `Label changed to ${data?.newLabel || 'unknown'}`;
      case 'score_updated':
        return 'Story scores updated';
      case 'item_added':
        return 'New item added to story';
      default:
        return 'Story updated';
    }
  }
}
