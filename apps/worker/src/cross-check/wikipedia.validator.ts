/**
 * Wikipedia Validator
 * 
 * Cross-check claims against Wikipedia articles using the MediaWiki API.
 * Extracts relevant articles and performs semantic similarity matching.
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  CrossCheckInput,
  CrossCheckResult,
  CrossCheckEvidence,
  WikipediaResult,
} from './cross-check.types';

@Injectable()
export class WikipediaValidator {
  private readonly logger = new Logger(WikipediaValidator.name);
  private readonly baseUrl = 'https://en.wikipedia.org/w/api.php';

  constructor(private readonly httpService: HttpService) {}

  async validate(input: CrossCheckInput): Promise<CrossCheckResult> {
    const startTime = Date.now();
    
    try {
      // Search for relevant Wikipedia articles
      const searchResults = await this.searchWikipedia(input.claim, input.keywords);
      
      if (searchResults.length === 0) {
        return this.buildResult('unverified', 0.3, [], {
          reason: 'No relevant Wikipedia articles found',
          searchQuery: input.claim,
        }, startTime);
      }

      // Get detailed content for top matches
      const articles = await this.fetchArticleContents(searchResults.slice(0, 3));
      
      // Analyze relevance and extract evidence
      const evidence = this.extractEvidence(articles, input.claim);
      const relevanceScore = this.calculateRelevance(articles, input.claim);
      
      // Determine verification status
      const status = this.determineStatus(relevanceScore, evidence);
      const confidence = this.calculateConfidence(relevanceScore, evidence);

      return this.buildResult(status, confidence, evidence, {
        articlesFound: articles.length,
        topArticle: articles[0]?.title,
        relevanceScore,
      }, startTime);

    } catch (error) {
      this.logger.error(`Wikipedia validation failed: ${error.message}`);
      return this.buildResult('error', 0, [], {
        error: error.message,
      }, startTime);
    }
  }

  private async searchWikipedia(query: string, keywords?: string[]): Promise<WikipediaResult[]> {
    const searchQuery = keywords?.length ? keywords.join(' ') : query;
    
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: searchQuery,
      format: 'json',
      origin: '*',
      srlimit: '5',
    });

    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}?${params.toString()}`)
    );

    const searchResults = response.data.query?.search || [];
    
    return searchResults.map((result: any) => ({
      pageId: result.pageid,
      title: result.title,
      extract: result.snippet,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`,
      relevanceScore: this.calculateSearchRelevance(result, query),
    }));
  }

  private async fetchArticleContents(articles: WikipediaResult[]): Promise<WikipediaResult[]> {
    const pageIds = articles.map(a => a.pageId).join('|');
    
    const params = new URLSearchParams({
      action: 'query',
      pageids: pageIds,
      prop: 'extracts|info',
      exintro: 'true',
      explaintext: 'true',
      inprop: 'url',
      format: 'json',
      origin: '*',
    });

    const response = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}?${params.toString()}`)
    );

    const pages = response.data.query?.pages || {};
    
    return Object.values(pages).map((page: any) => ({
      pageId: page.pageid,
      title: page.title,
      extract: page.extract || '',
      url: page.fullurl || page.canonicalurl || '',
      relevanceScore: 0,
    }));
  }

  private extractEvidence(articles: WikipediaResult[], claim: string): CrossCheckEvidence[] {
    const evidence: CrossCheckEvidence[] = [];
    const claimLower = claim.toLowerCase();
    const claimWords = new Set(claimLower.split(/\s+/).filter(w => w.length > 3));

    for (const article of articles) {
      const extractLower = article.extract.toLowerCase();
      
      // Check for keyword matches
      let matchCount = 0;
      for (const word of claimWords) {
        if (extractLower.includes(word)) {
          matchCount++;
        }
      }
      
      const matchRatio = matchCount / claimWords.size;
      
      if (matchRatio > 0.3) {
        evidence.push({
          type: 'url',
          value: article.url,
          source: 'wikipedia',
          relevance: matchRatio,
        });
        
        evidence.push({
          type: 'snippet',
          value: article.extract.substring(0, 300),
          source: `wikipedia:${article.title}`,
          relevance: matchRatio,
        });
      }
    }

    return evidence;
  }

  private calculateRelevance(articles: WikipediaResult[], claim: string): number {
    if (articles.length === 0) return 0;
    
    const claimWords = new Set(claim.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    let totalScore = 0;
    
    for (const article of articles) {
      const extractWords = new Set(article.extract.toLowerCase().split(/\s+/));
      let matches = 0;
      
      for (const word of claimWords) {
        if (extractWords.has(word)) matches++;
      }
      
      totalScore += matches / claimWords.size;
    }
    
    return Math.min(totalScore / articles.length, 1);
  }

  private calculateSearchRelevance(result: any, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const titleWords = result.title.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of queryWords) {
      if (titleWords.some((tw: string) => tw.includes(word))) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  private determineStatus(relevanceScore: number, evidence: CrossCheckEvidence[]): 'verified' | 'contradicted' | 'unverified' {
    if (relevanceScore > 0.7 && evidence.length >= 2) {
      return 'verified';
    } else if (relevanceScore > 0.4) {
      return 'unverified';
    }
    return 'unverified';
  }

  private calculateConfidence(relevanceScore: number, evidence: CrossCheckEvidence[]): number {
    const evidenceBonus = Math.min(evidence.length * 0.1, 0.3);
    return Math.min(relevanceScore + evidenceBonus, 1);
  }

  private buildResult(
    status: 'verified' | 'contradicted' | 'unverified' | 'error',
    confidence: number,
    evidence: CrossCheckEvidence[],
    metadata: Record<string, unknown>,
    startTime: number
  ): CrossCheckResult {
    return {
      source: 'wikipedia',
      status,
      confidence,
      evidence,
      metadata,
      checkedAt: new Date(),
      responseTimeMs: Date.now() - startTime,
    };
  }
}
