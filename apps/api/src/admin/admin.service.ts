import {
  Injectable,
  Inject,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { Logger } from 'nestjs-pino';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { RedisService } from '@/database/redis.service';
import { stories, claims, storyEvents } from '@/database/schema';

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

@Injectable()
export class AdminService {
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
