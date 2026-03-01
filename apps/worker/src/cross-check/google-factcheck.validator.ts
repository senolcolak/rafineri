/**
 * Google Fact Check Validator
 * 
 * Uses Google's Fact Check Tools API to verify claims
 * against fact-checking articles from trusted publishers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import {
  CrossCheckInput,
  CrossCheckResult,
  CrossCheckEvidence,
  GoogleFactCheckResult,
} from './cross-check.types';

@Injectable()
export class GoogleFactCheckValidator {
  private readonly logger = new Logger(GoogleFactCheckValidator.name);
  private readonly baseUrl = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async validate(input: CrossCheckInput): Promise<CrossCheckResult> {
    const startTime = Date.now();
    const apiKey = this.configService.get<string>('GOOGLE_FACTCHECK_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('Google Fact Check API key not configured');
      return this.buildResult('error', 0, [], {
        error: 'API key not configured',
      }, startTime);
    }

    try {
      // Call Google Fact Check API
      const params = new URLSearchParams({
        key: apiKey,
        query: input.claim,
        languageCode: 'en',
      });

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}?${params.toString()}`)
      );

      const claims = response.data.claims || [];
      
      if (claims.length === 0) {
        return this.buildResult('unverified', 0.2, [], {
          reason: 'No fact-checks found for this claim',
          query: input.claim,
        }, startTime);
      }

      // Analyze fact-check results
      const evidence = this.extractEvidence(claims);
      const rating = this.aggregateRatings(claims);
      
      return this.buildResult(
        rating.status,
        rating.confidence,
        evidence,
        {
          claimsFound: claims.length,
          topClaimant: claims[0]?.claimant,
          ratings: rating.breakdown,
        },
        startTime
      );

    } catch (error) {
      this.logger.error(`Google Fact Check validation failed: ${error.message}`);
      return this.buildResult('error', 0, [], {
        error: error.message,
      }, startTime);
    }
  }

  private extractEvidence(claims: GoogleFactCheckResult[]): CrossCheckEvidence[] {
    const evidence: CrossCheckEvidence[] = [];
    
    for (const claim of claims.slice(0, 3)) {
      for (const review of claim.claimReview || []) {
        evidence.push({
          type: 'url',
          value: review.url,
          source: review.publisher?.name || 'unknown',
          relevance: 0.9,
        });
        
        evidence.push({
          type: 'text',
          value: `${review.textualRating} - ${review.title}`,
          source: review.publisher?.name || 'unknown',
          relevance: 0.85,
        });
      }
    }
    
    return evidence;
  }

  private aggregateRatings(claims: GoogleFactCheckResult[]): {
    status: 'verified' | 'contradicted' | 'unverified';
    confidence: number;
    breakdown: Record<string, number>;
  } {
    const ratings: Record<string, number> = {};
    let totalReviews = 0;
    
    // Common fact-check ratings mapped to standardized scores
    const ratingScores: Record<string, number> = {
      'true': 1,
      'mostly true': 0.8,
      'half true': 0.5,
      'mostly false': 0.2,
      'false': 0,
      'pants on fire': 0,
      'misleading': 0.1,
      'correct': 1,
      'incorrect': 0,
      'unproven': 0.5,
      'satire': 0.5,
    };
    
    for (const claim of claims) {
      for (const review of claim.claimReview || []) {
        const rating = review.textualRating?.toLowerCase() || 'unknown';
        ratings[rating] = (ratings[rating] || 0) + 1;
        totalReviews++;
      }
    }
    
    // Calculate weighted score
    let weightedScore = 0;
    for (const [rating, count] of Object.entries(ratings)) {
      const score = ratingScores[rating] ?? 0.5;
      weightedScore += score * (count / totalReviews);
    }
    
    // Determine status based on weighted score
    let status: 'verified' | 'contradicted' | 'unverified';
    if (weightedScore >= 0.7) {
      status = 'verified';
    } else if (weightedScore <= 0.3) {
      status = 'contradicted';
    } else {
      status = 'unverified';
    }
    
    // Calculate confidence based on number of reviews
    const confidence = Math.min(totalReviews * 0.2 + 0.3, 0.95);
    
    return { status, confidence, breakdown: ratings };
  }

  private buildResult(
    status: 'verified' | 'contradicted' | 'unverified' | 'error',
    confidence: number,
    evidence: CrossCheckEvidence[],
    metadata: Record<string, unknown>,
    startTime: number
  ): CrossCheckResult {
    return {
      source: 'google-factcheck',
      status,
      confidence,
      evidence,
      metadata,
      checkedAt: new Date(),
      responseTimeMs: Date.now() - startTime,
    };
  }
}
