import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockScoringService, ScoreResult } from './mock-scoring.service';

interface Story {
  id: string;
  title: string;
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
        s.canonical_url as "canonicalUrl",
        s.item_count as "itemCount",
        array_agg(DISTINCT i.source) as "sources"
      FROM stories s
      LEFT JOIN story_items si ON s.id = si.story_id
      LEFT JOIN items i ON si.item_id = i.id
      WHERE s.id = $1
      GROUP BY s.id, s.title, s.canonical_url, s.item_count
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

    if (mockMode) {
      return this.mockScoringService.score(story);
    }

    // TODO: Implement real AI scoring
    // This would call an LLM API or similar
    this.logger.warn('Real scoring not implemented, falling back to mock');
    return this.mockScoringService.score(story);
  }

  private async persistScore(storyId: string, result: ScoreResult): Promise<void> {
    try {
      await this.db.transaction(async (client) => {
        // Update story with score results
        const updateStoryQuery = `
          UPDATE stories
          SET 
            score_label = $2,
            score_confidence = $3,
            score_summary = $4,
            score_reasons = $5,
            scored_at = $6,
            updated_at = $6
          WHERE id = $1
        `;

        await client.execute(updateStoryQuery, [
          storyId,
          result.label,
          result.confidence,
          result.summary,
          JSON.stringify(result.reasons),
          new Date(),
        ]);

        // Delete old claims and evidence for this story
        await this.deleteOldClaims(storyId, client);

        // Insert new claims
        for (const claim of result.claims) {
          await this.insertClaim(storyId, claim, client);
        }

        // Insert new evidence
        for (const evidence of result.evidence) {
          await this.insertEvidence(evidence, client);
        }
      });

      this.logger.debug(`Score persisted for story ${storyId}`);
    } catch (error) {
      this.logger.error(`Failed to persist score for story ${storyId}:`, error);
      throw error;
    }
  }

  private async deleteOldClaims(storyId: string, client: any): Promise<void> {
    // First delete evidence linked to claims of this story
    const deleteEvidenceQuery = `
      DELETE FROM evidence
      WHERE claim_id IN (
        SELECT id FROM claims WHERE story_id = $1
      )
    `;
    await client.execute(deleteEvidenceQuery, [storyId]);

    // Then delete claims
    const deleteClaimsQuery = `DELETE FROM claims WHERE story_id = $1`;
    await client.execute(deleteClaimsQuery, [storyId]);
  }

  private async insertClaim(
    storyId: string, 
    claim: { text: string; type: string; confidence: number },
    client: any
  ): Promise<string> {
    const claimId = `claim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const query = `
      INSERT INTO claims (id, story_id, text, type, confidence, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await client.execute(query, [
      claimId,
      storyId,
      claim.text,
      claim.type,
      claim.confidence,
      new Date(),
    ]);

    return claimId;
  }

  private async insertEvidence(
    evidence: { claimText: string; source: string; url: string; text: string; supports: boolean; confidence: number },
    client: any
  ): Promise<void> {
    // Find the claim ID by text (simplified - in production, pass claim IDs directly)
    const findClaimQuery = `
      SELECT id FROM claims WHERE text = $1 ORDER BY created_at DESC LIMIT 1
    `;
    const claims = await client.query(findClaimQuery, [evidence.claimText]);
    
    if (claims.length === 0) {
      this.logger.warn(`Claim not found for evidence: ${evidence.text.substring(0, 50)}...`);
      return;
    }

    const claimId = claims[0].id;
    const evidenceId = `evidence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const query = `
      INSERT INTO evidence (id, claim_id, source, url, text, supports, confidence, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await client.execute(query, [
      evidenceId,
      claimId,
      evidence.source,
      evidence.url,
      evidence.text,
      evidence.supports,
      evidence.confidence,
      new Date(),
    ]);
  }

  private async writeScoreEvent(storyId: string, result: ScoreResult): Promise<void> {
    const query = `
      INSERT INTO story_events (story_id, event_type, event_data, created_at)
      VALUES ($1, $2, $3, $4)
    `;

    const eventData = {
      label: result.label,
      confidence: result.confidence,
      claimCount: result.claims.length,
      evidenceCount: result.evidence.length,
    };

    try {
      await this.db.execute(query, [
        storyId,
        'scored',
        JSON.stringify(eventData),
        new Date(),
      ]);
    } catch (error) {
      this.logger.error('Failed to write score event:', error);
    }
  }
}
