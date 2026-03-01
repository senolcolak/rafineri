import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockScoringService, ScoreResult } from './mock-scoring.service';
import { ScoringService as AiScoringService } from '@/ai/scoring.service';

interface Story {
  id: string;
  title: string;
  summary?: string;
  canonicalUrl: string;
  itemCount: number;
  sources: string[];
}

interface Claim {
  id: string;
  storyId: string;
  text: string;
  type: string;
  confidence: number;
  createdAt: Date;
}

interface Evidence {
  id: string;
  claimId: string;
  source: string;
  url: string;
  text: string;
  supports: boolean;
  confidence: number;
  createdAt: Date;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mockScoringService: MockScoringService,
    private readonly aiScoringService: AiScoringService,
    @Inject('DATABASE_CLIENT') private readonly db: any,
  ) {}

  async scoreStory(storyId: string): Promise<ScoreResult> {
    this.logger.log(`Scoring story ${storyId}`);

    // Fetch story details
    const story = await this.fetchStory(storyId);
    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    // Generate score
    const result = await this.generateScore(story);

    // Persist results
    await this.persistScore(storyId, result);

    // Write story event
    await this.writeScoreEvent(storyId, result);

    this.logger.log(
      `Story ${storyId} scored: ${result.label} (${(result.confidence * 100).toFixed(1)}%)`
    );

    return result;
  }

  private async fetchStory(storyId: string): Promise<Story | null> {
    const query = `
      SELECT 
        s.id,
        s.title,
        s.summary,
        s.canonical_url as "canonicalUrl",
        s.item_count as "itemCount",
        array_agg(DISTINCT i.source) as "sources"
      FROM stories s
      LEFT JOIN story_items si ON s.id = si.story_id
      LEFT JOIN items i ON si.item_id = i.id
      WHERE s.id = $1
      GROUP BY s.id, s.title, s.summary, s.canonical_url, s.item_count
    `;

    try {
      const results = await this.db.query(query, [storyId]);
      return results[0] || null;
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
      return this.mockScoringService.score(story);
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
          storyId: story.id,
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
        this.logger.error({ err: error }, 'AI scoring failed, falling back to rules');
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
      storyId: story.id,
      label,
      confidence: Math.min(1, confidence),
      summary: `Rule-based scoring: ${label} (${(confidence * 100).toFixed(0)}% confidence)`,
      reasons: reasons.length > 0 ? reasons : ['Insufficient data for reliable scoring'],
      claims: [],
      evidence: [],
    };
  }

  private async persistScore(storyId: string, result: ScoreResult): Promise<void> {
    try {
      await this.db.transaction(async (client) => {
        // Update story with score results
        const updateStoryQuery = `
          UPDATE stories
          SET 
            label = $2,
            confidence = $3,
            summary = $4,
            updated_at = $5
          WHERE id = $1
        `;

        await client.execute(updateStoryQuery, [
          storyId,
          result.label,
          result.confidence,
          result.summary,
          new Date(),
        ]);

        // Note: In full implementation, we would also:
        // - Delete old claims and evidence
        // - Insert new claims from result.claims
        // - Insert new evidence from result.evidence
      });
    } catch (error) {
      this.logger.error('Failed to persist score:', error);
      throw error;
    }
  }

  private async writeScoreEvent(storyId: string, result: ScoreResult): Promise<void> {
    try {
      const query = `
        INSERT INTO story_events (story_id, event_type, data, created_at)
        VALUES ($1, 'score_updated', $2, $3)
      `;

      const data = {
        label: result.label,
        confidence: result.confidence,
        summary: result.summary,
        reasons: result.reasons,
      };

      await this.db.execute(query, [storyId, JSON.stringify(data), new Date()]);
    } catch (error) {
      this.logger.error('Failed to write score event:', error);
    }
  }
}
