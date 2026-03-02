/**
 * NewsAPI Validator
 * 
 * Validates claims by searching for news coverage.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossCheckInput, CrossCheckResult, CrossCheckEvidence } from './cross-check.types';

@Injectable()
export class NewsApiValidator {
  private readonly logger = new Logger(NewsApiValidator.name);
  private readonly baseUrl = 'https://newsapi.org/v2/everything';

  constructor(private readonly configService: ConfigService) {}

  async validate(input: CrossCheckInput): Promise<CrossCheckResult> {
    const startTime = Date.now();
    const apiKey = this.configService.get<string>('NEWSAPI_KEY');

    if (!apiKey) {
      return {
        source: 'newsapi',
        status: 'error',
        confidence: 0,
        evidence: [],
        metadata: { error: 'NEWSAPI_KEY not configured' },
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Build search query from claim and keywords
      const query = input.keywords?.join(' OR ') || input.claim;
      
      const params = new URLSearchParams({
        q: query,
        apiKey: apiKey,
        language: 'en',
        sortBy: 'relevancy',
        pageSize: '5',
      });

      // Add date filter (last 30 days)
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      params.append('from', fromDate.toISOString().split('T')[0]);

      const response = await fetch(`${this.baseUrl}?${params}`);
      if (!response.ok) {
        if (response.status === 429) {
          return {
            source: 'newsapi',
            status: 'error',
            confidence: 0,
            evidence: [],
            metadata: { error: 'Rate limit exceeded' },
            checkedAt: new Date(),
            responseTimeMs: Date.now() - startTime,
          };
        }
        throw new Error(`NewsAPI error: ${response.status}`);
      }

      const data = await response.json();
      const articles = data.articles || [];

      if (articles.length === 0) {
        return {
          source: 'newsapi',
          status: 'unverified',
          confidence: 0,
          evidence: [],
          metadata: { message: 'No news coverage found for this claim' },
          checkedAt: new Date(),
          responseTimeMs: Date.now() - startTime,
        };
      }

      // Analyze coverage
      const evidence: CrossCheckEvidence[] = articles.slice(0, 3).map((article: { url: string; title: string; source: { name: string } }) => ({
        type: 'url',
        value: article.url,
        source: article.source?.name || 'Unknown',
        relevance: 0.6,
      }));

      // Add snippets
      articles.slice(0, 2).forEach((article: { title: string; description: string }) => {
        if (article.description) {
          evidence.push({
            type: 'snippet',
            value: article.description.substring(0, 150) + '...',
            source: 'NewsAPI',
            relevance: 0.7,
          });
        }
      });

      // Calculate confidence based on coverage volume
      const coverageScore = Math.min(articles.length / 10, 1); // Cap at 10 articles
      let status: CrossCheckResult['status'] = 'unverified';
      
      if (articles.length >= 5) {
        status = 'verified';
      } else if (articles.length >= 2) {
        status = 'verified';
      } else {
        status = 'unverified';
      }

      return {
        source: 'newsapi',
        status,
        confidence: coverageScore * 0.7, // Max 0.7 confidence from news coverage alone
        evidence,
        metadata: {
          totalResults: data.totalResults || articles.length,
          articlesFound: articles.length,
        },
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`NewsAPI validation failed: ${error.message}`);
      return {
        source: 'newsapi',
        status: 'error',
        confidence: 0,
        evidence: [],
        metadata: { error: error.message },
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }
}
