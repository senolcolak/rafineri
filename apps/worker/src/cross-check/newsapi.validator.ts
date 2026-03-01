/**
 * NewsAPI Validator
 * 
 * Cross-check claims against recent news articles.
 * Searches for coverage across multiple news sources.
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  CrossCheckInput,
  CrossCheckResult,
  CrossCheckEvidence,
  NewsSearchResult,
} from './cross-check.types';

@Injectable()
export class NewsApiValidator {
  private readonly logger = new Logger(NewsApiValidator.name);
  private readonly baseUrl = 'https://newsapi.org/v2';

  // Trusted news sources (high credibility)
  private readonly trustedSources = [
    'reuters', 'associated-press', 'bbc-news', 'the-guardian-uk',
    'the-new-york-times', 'the-washington-post', 'wall-street-journal',
    'bloomberg', 'financial-times', 'economist',
  ];

  // Sources to flag for potential bias
  private readonly flaggedSources = [
    'breitbart-news', 'infowars', 'natural-news',
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async validate(input: CrossCheckInput): Promise<CrossCheckResult> {
    const startTime = Date.now();
    const apiKey = this.configService.get<string>('NEWSAPI_KEY');
    
    if (!apiKey) {
      this.logger.warn('NewsAPI key not configured');
      return this.buildResult('error', 0, [], {
        error: 'API key not configured',
      }, startTime);
    }

    try {
      // Search for news articles
      const searchQuery = this.buildSearchQuery(input);
      const articles = await this.searchNews(searchQuery, apiKey);
      
      if (articles.length === 0) {
        return this.buildResult('unverified', 0.2, [], {
          reason: 'No news coverage found',
          query: searchQuery,
        }, startTime);
      }

      // Analyze coverage
      const evidence = this.extractEvidence(articles);
      const coverage = this.analyzeCoverage(articles);
      
      // Determine verification status
      const status = this.determineStatus(coverage);
      const confidence = this.calculateConfidence(coverage);

      return this.buildResult(status, confidence, evidence, {
        totalArticles: coverage.total,
        trustedSources: coverage.trustedCount,
        flaggedSources: coverage.flaggedCount,
        coverageTimeSpan: coverage.timeSpan,
        sourceDiversity: coverage.uniqueSources,
      }, startTime);

    } catch (error) {
      this.logger.error(`NewsAPI validation failed: ${error.message}`);
      return this.buildResult('error', 0, [], {
        error: error.message,
      }, startTime);
    }
  }

  private buildSearchQuery(input: CrossCheckInput): string {
    // Extract key terms from claim
    const words = input.claim
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !this.isStopWord(w));
    
    // Use keywords if provided, otherwise use claim words
    const searchTerms = input.keywords?.length 
      ? input.keywords 
      : words.slice(0, 5);
    
    return searchTerms.join(' OR ');
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'about', 'after', 'again', 'being', 'could', 'does', 'doing',
      'having', 'here', 'just', 'more', 'most', 'only', 'other',
      'over', 'same', 'should', 'some', 'such', 'than', 'that',
      'their', 'them', 'then', 'there', 'these', 'they', 'this',
      'those', 'through', 'under', 'very', 'what', 'when', 'where',
      'which', 'while', 'with', 'would',
    ]);
    return stopWords.has(word);
  }

  private async searchNews(query: string, apiKey: string): Promise<NewsSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      language: 'en',
      sortBy: 'relevancy',
      pageSize: '20',
      apiKey,
    });

    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/everything?${params.toString()}`)
    );

    const articles = response.data.articles || [];
    
    return articles.map((article: any) => ({
      title: article.title,
      source: article.source?.id || article.source?.name || 'unknown',
      publishedAt: article.publishedAt,
      url: article.url,
      snippet: article.description || article.content || '',
      relevanceScore: 0,
    }));
  }

  private extractEvidence(articles: NewsSearchResult[]): CrossCheckEvidence[] {
    const evidence: CrossCheckEvidence[] = [];
    
    // Take top articles from diverse sources
    const uniqueSources = new Map<string, NewsSearchResult>();
    for (const article of articles) {
      if (!uniqueSources.has(article.source)) {
        uniqueSources.set(article.source, article);
      }
    }
    
    for (const [source, article] of uniqueSources.entries()) {
      const isTrusted = this.trustedSources.includes(source);
      const isFlagged = this.flaggedSources.includes(source);
      
      let relevance = 0.5;
      if (isTrusted) relevance = 0.9;
      if (isFlagged) relevance = 0.1;
      
      evidence.push({
        type: 'url',
        value: article.url,
        source: `news:${source}`,
        relevance,
      });
      
      evidence.push({
        type: 'snippet',
        value: `${article.title} - ${article.snippet.substring(0, 150)}`,
        source: `news:${source}`,
        relevance: relevance * 0.9,
      });
    }
    
    return evidence.slice(0, 10); // Limit evidence
  }

  private analyzeCoverage(articles: NewsSearchResult[]): {
    total: number;
    trustedCount: number;
    flaggedCount: number;
    uniqueSources: number;
    timeSpan: string;
  } {
    const sources = new Set(articles.map(a => a.source));
    const trustedCount = articles.filter(a => 
      this.trustedSources.includes(a.source)
    ).length;
    const flaggedCount = articles.filter(a => 
      this.flaggedSources.includes(a.source)
    ).length;
    
    // Calculate time span
    const dates = articles
      .map(a => new Date(a.publishedAt))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    
    let timeSpan = 'unknown';
    if (dates.length >= 2) {
      const days = Math.round(
        (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24)
      );
      timeSpan = `${days} days`;
    }

    return {
      total: articles.length,
      trustedCount,
      flaggedCount,
      uniqueSources: sources.size,
      timeSpan,
    };
  }

  private determineStatus(coverage: {
    total: number;
    trustedCount: number;
    flaggedCount: number;
  }): 'verified' | 'contradicted' | 'unverified' {
    // If multiple trusted sources report, consider verified
    if (coverage.trustedCount >= 2 && coverage.total >= 3) {
      return 'verified';
    }
    
    // If only flagged sources report, be skeptical
    if (coverage.flaggedCount > coverage.trustedCount) {
      return 'unverified';
    }
    
    // Single source or no trusted sources
    if (coverage.total < 2 || coverage.trustedCount === 0) {
      return 'unverified';
    }
    
    return 'verified';
  }

  private calculateConfidence(coverage: {
    total: number;
    trustedCount: number;
    uniqueSources: number;
  }): number {
    let confidence = 0.3;
    
    // Bonus for trusted sources
    confidence += coverage.trustedCount * 0.15;
    
    // Bonus for source diversity
    confidence += Math.min(coverage.uniqueSources * 0.05, 0.2);
    
    // Bonus for total coverage
    confidence += Math.min(coverage.total * 0.02, 0.15);
    
    return Math.min(confidence, 0.95);
  }

  private buildResult(
    status: 'verified' | 'contradicted' | 'unverified' | 'error',
    confidence: number,
    evidence: CrossCheckEvidence[],
    metadata: Record<string, unknown>,
    startTime: number
  ): CrossCheckResult {
    return {
      source: 'newsapi',
      status,
      confidence,
      evidence,
      metadata,
      checkedAt: new Date(),
      responseTimeMs: Date.now() - startTime,
    };
  }
}
