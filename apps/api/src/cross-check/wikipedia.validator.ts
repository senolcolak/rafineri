/**
 * Wikipedia Validator
 * 
 * Validates claims against Wikipedia articles using the MediaWiki API.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossCheckInput, CrossCheckResult, CrossCheckEvidence } from './cross-check.types';

@Injectable()
export class WikipediaValidator {
  private readonly logger = new Logger(WikipediaValidator.name);
  private readonly baseUrl = 'https://en.wikipedia.org/w/api.php';

  constructor(private readonly configService: ConfigService) {}

  async validate(input: CrossCheckInput): Promise<CrossCheckResult> {
    const startTime = Date.now();
    
    try {
      // Search for relevant Wikipedia articles
      const searchQuery = input.keywords?.join(' ') || input.claim;
      const searchResults = await this.searchWikipedia(searchQuery);
      
      if (searchResults.length === 0) {
        return {
          source: 'wikipedia',
          status: 'unverified',
          confidence: 0,
          evidence: [],
          metadata: { message: 'No relevant Wikipedia articles found' },
          checkedAt: new Date(),
          responseTimeMs: Date.now() - startTime,
        };
      }

      // Get details of the most relevant article
      const topResult = searchResults[0];
      const article = await this.getArticle(topResult.title);

      // Analyze relevance to claim
      const relevanceScore = this.calculateRelevance(input.claim, article.extract);
      const evidence: CrossCheckEvidence[] = [
        {
          type: 'url',
          value: article.url,
          source: 'wikipedia',
          relevance: relevanceScore,
        },
        {
          type: 'snippet',
          value: article.extract.substring(0, 200) + '...',
          source: 'wikipedia',
          relevance: relevanceScore,
        },
      ];

      // Determine status based on relevance
      let status: CrossCheckResult['status'] = 'unverified';
      let confidence = relevanceScore;

      if (relevanceScore > 0.7) {
        status = 'verified';
      } else if (relevanceScore < 0.3 && relevanceScore > 0) {
        // Low relevance might indicate contradiction
        status = 'contradicted';
        confidence = 1 - relevanceScore;
      }

      return {
        source: 'wikipedia',
        status,
        confidence,
        evidence,
        metadata: {
          articleTitle: article.title,
          articleId: article.pageId,
          searchResults: searchResults.length,
        },
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Wikipedia validation failed: ${error.message}`);
      return {
        source: 'wikipedia',
        status: 'error',
        confidence: 0,
        evidence: [],
        metadata: { error: error.message },
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  private async searchWikipedia(query: string): Promise<Array<{ pageId: number; title: string; snippet: string }>> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      format: 'json',
      origin: '*',
      srlimit: '3',
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();
    return data.query?.search || [];
  }

  private async getArticle(title: string): Promise<{ pageId: number; title: string; extract: string; url: string }> {
    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      exsentences: '5',
      format: 'json',
      origin: '*',
    });

    const response = await fetch(`${this.baseUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0] as { pageid: number; title: string; extract: string };

    return {
      pageId: page.pageid,
      title: page.title,
      extract: page.extract || '',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    };
  }

  private calculateRelevance(claim: string, text: string): number {
    if (!text) return 0;

    const claimWords = claim.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);

    const textWords = text.toLowerCase();
    let matchCount = 0;

    for (const word of claimWords) {
      if (textWords.includes(word)) {
        matchCount++;
      }
    }

    return claimWords.length > 0 ? matchCount / claimWords.length : 0;
  }
}
