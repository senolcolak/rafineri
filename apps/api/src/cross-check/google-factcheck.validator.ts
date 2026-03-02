/**
 * Google Fact Check Validator
 * 
 * Validates claims against Google's Fact Check Tools API.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrossCheckInput, CrossCheckResult, CrossCheckEvidence } from './cross-check.types';

@Injectable()
export class GoogleFactCheckValidator {
  private readonly logger = new Logger(GoogleFactCheckValidator.name);
  private readonly baseUrl = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

  constructor(private readonly configService: ConfigService) {}

  async validate(input: CrossCheckInput): Promise<CrossCheckResult> {
    const startTime = Date.now();
    const apiKey = this.configService.get<string>('GOOGLE_FACTCHECK_API_KEY');

    if (!apiKey) {
      return {
        source: 'google-factcheck',
        status: 'error',
        confidence: 0,
        evidence: [],
        metadata: { error: 'GOOGLE_FACTCHECK_API_KEY not configured' },
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }

    try {
      const params = new URLSearchParams({
        query: input.claim,
        key: apiKey,
        languageCode: 'en',
      });

      if (input.keywords && input.keywords.length > 0) {
        params.append('query', input.keywords.join(' '));
      }

      const response = await fetch(`${this.baseUrl}?${params}`);
      if (!response.ok) {
        throw new Error(`Google Fact Check API error: ${response.status}`);
      }

      const data = await response.json();
      const claims = data.claims || [];

      if (claims.length === 0) {
        return {
          source: 'google-factcheck',
          status: 'unverified',
          confidence: 0,
          evidence: [],
          metadata: { message: 'No fact-checks found for this claim' },
          checkedAt: new Date(),
          responseTimeMs: Date.now() - startTime,
        };
      }

      // Analyze the most relevant fact-check
      const topClaim = claims[0];
      const reviews = topClaim.claimReview || [];
      
      if (reviews.length === 0) {
        return {
          source: 'google-factcheck',
          status: 'unverified',
          confidence: 0,
          evidence: [],
          metadata: { message: 'Claim found but no reviews available' },
          checkedAt: new Date(),
          responseTimeMs: Date.now() - startTime,
        };
      }

      const review = reviews[0];
      const textualRating = review.textualRating?.toLowerCase() || '';
      
      // Parse rating to determine status
      let status: CrossCheckResult['status'] = 'unverified';
      let confidence = 0.7;

      if (textualRating.includes('true') || textualRating.includes('correct') || textualRating.includes('accurate')) {
        status = 'verified';
        confidence = 0.85;
      } else if (textualRating.includes('false') || textualRating.includes('incorrect') || textualRating.includes('misleading')) {
        status = 'contradicted';
        confidence = 0.85;
      } else if (textualRating.includes('mixed') || textualRating.includes('partially')) {
        status = 'unverified';
        confidence = 0.5;
      }

      const evidence: CrossCheckEvidence[] = reviews.map((r: { url: string; title: string; publisher: { name: string } }) => ({
        type: 'url',
        value: r.url,
        source: r.publisher?.name || 'Unknown',
        relevance: 0.8,
      }));

      if (review.title) {
        evidence.push({
          type: 'text',
          value: `${review.title} - Rating: ${review.textualRating}`,
          source: review.publisher?.name || 'Unknown',
          relevance: 0.9,
        });
      }

      return {
        source: 'google-factcheck',
        status,
        confidence,
        evidence,
        metadata: {
          claimant: topClaim.claimant,
          claimDate: topClaim.claimDate,
          reviewCount: reviews.length,
          textualRating: review.textualRating,
        },
        checkedAt: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Google Fact Check validation failed: ${error.message}`);
      return {
        source: 'google-factcheck',
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
