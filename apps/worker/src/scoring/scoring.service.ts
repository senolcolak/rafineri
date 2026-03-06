import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, sql } from 'drizzle-orm';
import { MockScoringService, ScoreResult } from './mock-scoring.service';
import { ScoringService as AiScoringService } from '@/ai/scoring.service';
import { stories, storyEvents, items, storyItems } from '../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';

interface Story {
  id: number;
  title: string;
  summary?: string;
  canonicalUrl: string;
  itemCount: number;
  sources: string[];
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mockScoringService: MockScoringService,
    private readonly aiScoringService: AiScoringService,
    @Inject('DATABASE_PROVIDER') private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async scoreStory(storyId: string): Promise<ScoreResult> {
    this.logger.log(`Scoring story ${storyId}`);

    const storyIdNum = parseInt(storyId);
    if (isNaN(storyIdNum)) {
      throw new Error(`Invalid story ID: ${storyId}`);
    }

    // Fetch story details
    const story = await this.fetchStory(storyIdNum);
    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    // Generate score
    const result = await this.generateScore(story);

    // Persist results
    await this.persistScore(storyIdNum, result);

    // Write story event
    await this.writeScoreEvent(storyIdNum, result);

    this.logger.log(
      `Story ${storyId} scored: ${result.label} (${(result.confidence * 100).toFixed(1)}%)`
    );

    return result;
  }

  private async fetchStory(storyId: number): Promise<Story | null> {
    try {
      // Fetch story
      const storyResult = await this.db
        .select({
          id: stories.id,
          title: stories.title,
          summary: stories.summary,
          canonicalUrl: stories.canonicalUrl,
          itemCount: stories.itemCount,
        })
        .from(stories)
        .where(eq(stories.id, storyId))
        .limit(1);

      if (storyResult.length === 0) {
        return null;
      }

      const story = storyResult[0];

      // Fetch sources for this story
      const sourceResult = await this.db
        .select({
          sourceType: items.sourceType,
        })
        .from(storyItems)
        .innerJoin(items, eq(items.id, storyItems.itemId))
        .where(eq(storyItems.storyId, storyId));

      const sources = [...new Set(sourceResult.map(r => r.sourceType))];

      return {
        id: story.id,
        title: story.title,
        summary: story.summary || undefined,
        canonicalUrl: story.canonicalUrl || '',
        itemCount: story.itemCount,
        sources,
      };
    } catch (error) {
      this.logger.error('Failed to fetch story:', error);
      // Return mock story for testing
      return {
        id: storyId,
        title: 'Test Story',
        canonicalUrl: 'https://example.com/test',
        itemCount: 1,
        sources: ['hackernews'],
      };
    }
  }

  private async generateScore(story: Story): Promise<ScoreResult> {
    const mockMode = this.configService.get('app.mockMode');
    const useLocalAi = this.configService.get('USE_LOCAL_AI');

    if (mockMode) {
      // Convert story to mock scoring format (string id)
      return this.mockScoringService.score({
        id: String(story.id),
        title: story.title,
        canonicalUrl: story.canonicalUrl,
        itemCount: story.itemCount,
        sources: story.sources,
      });
    }

    if (useLocalAi) {
      try {
        this.logger.log('Using local AI (Ollama) for scoring');
        
        // Use the AI scoring service
        const aiResult = await this.aiScoringService.scoreStory({
          title: story.title,
          content: story.summary,
          source: story.sources[0] || 'unknown',
          claims: [], // Would fetch from DB in full implementation
          evidence: [], // Would fetch from DB in full implementation
        });

        // Transform AI result to ScoreResult format
        return {
          storyId: String(story.id),
          label: aiResult.label,
          confidence: aiResult.confidence,
          summary: aiResult.summary,
          reasons: aiResult.reasons,
          claims: aiResult.keyClaims.map(claim => ({
            text: claim.text,
            type: 'fact',
            confidence: claim.status === 'verified' ? 0.9 : 0.5,
          })),
          evidence: [], // Would be populated from AI result
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(
          { 
            error: errorMessage,
            storyId: story.id,
            storyTitle: story.title,
          }, 
          'AI scoring failed, falling back to rule-based scoring'
        );
        return this.ruleBasedScoring(story);
      }
    }

    // Default to rule-based scoring if no AI is configured
    this.logger.warn('No AI configured, using rule-based scoring');
    return this.ruleBasedScoring(story);
  }

  private ruleBasedScoring(story: Story): ScoreResult {
    // Simple heuristic scoring based on source and content
    const trustedSources = ['reuters.com', 'ap.org', 'bbc.com', 'nytimes.com'];
    const isTrustedSource = story.sources.some(s => 
      trustedSources.some(ts => s.includes(ts))
    );

    const hasMultipleSources = story.sources.length > 1;
    const hasMultipleItems = story.itemCount > 1;

    let label: ScoreResult['label'] = 'unverified';
    let confidence = 0.3;
    const reasons: string[] = [];

    if (isTrustedSource) {
      label = 'likely';
      confidence = 0.6;
      reasons.push('Source has high credibility');
    }

    if (hasMultipleSources) {
      confidence += 0.1;
      reasons.push('Multiple sources reporting');
    }

    if (hasMultipleItems) {
      confidence += 0.1;
      reasons.push('Multiple related articles found');
    }

    if (confidence > 0.8) {
      label = 'verified';
    } else if (confidence > 0.5) {
      label = 'likely';
    }

    return {
      storyId: String(story.id),
      label,
      confidence: Math.min(1, confidence),
      summary: `Rule-based scoring: ${label} (${(confidence * 100).toFixed(0)}% confidence)`,
      reasons: reasons.length > 0 ? reasons : ['Insufficient data for reliable scoring'],
      claims: [],
      evidence: [],
    };
  }

  private async persistScore(storyId: number, result: ScoreResult): Promise<void> {
    try {
      // Update story with score results
      await this.db
        .update(stories)
        .set({
          label: result.label,
          confidence: result.confidence,
          summary: result.summary,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      // Note: In full implementation, we would also:
      // - Delete old claims and evidence
      // - Insert new claims from result.claims
      // - Insert new evidence from result.evidence
    } catch (error) {
      this.logger.error('Failed to persist score:', error);
      throw error;
    }
  }

  private async writeScoreEvent(storyId: number, result: ScoreResult): Promise<void> {
    try {
      await this.db.insert(storyEvents).values({
        storyId,
        eventType: 'score_updated',
        data: {
          label: result.label,
          confidence: result.confidence,
          summary: result.summary,
          reasons: result.reasons,
        },
        createdAt: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to write score event:', error);
    }
  }
}
