/**
 * Cross-Check Service
 * 
 * Orchestrates multi-source verification using multiple validators.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CrossCheckInput,
  CrossCheckResult,
  CrossCheckAggregate,
  ValidatorConfig,
  HttpCheckRule,
} from './cross-check.types';
import { WikipediaValidator } from './wikipedia.validator';
import { GoogleFactCheckValidator } from './google-factcheck.validator';
import { NewsApiValidator } from './newsapi.validator';
import { HttpValidator } from './http.validator';

@Injectable()
export class CrossCheckService {
  private readonly logger = new Logger(CrossCheckService.name);
  private readonly validators: Map<string, ValidatorConfig> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly wikipediaValidator: WikipediaValidator,
    private readonly googleFactCheckValidator: GoogleFactCheckValidator,
    private readonly newsApiValidator: NewsApiValidator,
    private readonly httpValidator: HttpValidator,
  ) {
    this.initializeValidators();
  }

  private initializeValidators(): void {
    const defaultConfigs: ValidatorConfig[] = [
      {
        name: 'wikipedia',
        enabled: true,
        weight: 0.3,
        timeoutMs: 10000,
        priority: 1,
      },
      {
        name: 'google-factcheck',
        enabled: !!this.configService.get('GOOGLE_FACTCHECK_API_KEY'),
        weight: 0.4,
        timeoutMs: 10000,
        priority: 2,
      },
      {
        name: 'newsapi',
        enabled: !!this.configService.get('NEWSAPI_KEY'),
        weight: 0.2,
        timeoutMs: 10000,
        priority: 3,
      },
      {
        name: 'http-validator',
        enabled: true,
        weight: 0.1,
        timeoutMs: 15000,
        priority: 4,
      },
    ];

    for (const config of defaultConfigs) {
      this.validators.set(config.name, config);
    }
  }

  /**
   * Perform cross-check across all enabled validators
   */
  async crossCheck(input: CrossCheckInput): Promise<CrossCheckAggregate> {
    this.logger.log(`Starting cross-check for claim: "${input.claim.substring(0, 50)}..."`);

    const startTime = Date.now();
    const results: CrossCheckResult[] = [];

    const enabledValidators = Array.from(this.validators.values())
      .filter(v => v.enabled)
      .sort((a, b) => a.priority - b.priority);

    const validationPromises = enabledValidators.map(async (config) => {
      try {
        const result = await this.runValidatorWithTimeout(config, input);
        return result;
      } catch (error) {
        this.logger.error(`Validator ${config.name} failed: ${(error as Error).message}`);
        return this.createErrorResult(config.name, (error as Error).message);
      }
    });

    const validatorResults = await Promise.all(validationPromises);
    results.push(...validatorResults);

    const aggregate = this.aggregateResults(results, enabledValidators);

    this.logger.log(`Cross-check completed in ${Date.now() - startTime}ms. Status: ${aggregate.overallStatus}, Confidence: ${aggregate.confidence.toFixed(2)}`);

    return aggregate;
  }

  /**
   * Cross-check with custom HTTP rules
   */
  async crossCheckWithHttpRules(
    input: CrossCheckInput,
    httpRules: HttpCheckRule[]
  ): Promise<CrossCheckAggregate> {
    this.logger.log(`Starting cross-check with ${httpRules.length} HTTP rules`);

    const startTime = Date.now();
    const results: CrossCheckResult[] = [];

    const standardResults = await this.crossCheck(input);
    results.push(...standardResults.results);

    if (httpRules.length > 0) {
      try {
        const httpResult = await this.httpValidator.validateWithRules(input, httpRules);
        results.push(httpResult);
      } catch (error) {
        this.logger.error(`HTTP validation failed: ${(error as Error).message}`);
        results.push(this.createErrorResult('http-validator', (error as Error).message));
      }
    }

    const enabledValidators = Array.from(this.validators.values())
      .filter(v => v.enabled);

    const aggregate = this.aggregateResults(results, enabledValidators);

    this.logger.log(`Cross-check with HTTP rules completed in ${Date.now() - startTime}ms`);

    return aggregate;
  }

  /**
   * Get validator configurations
   */
  getValidatorConfigs(): ValidatorConfig[] {
    return Array.from(this.validators.values());
  }

  /**
   * Update validator configuration
   */
  updateValidatorConfig(name: string, config: Partial<ValidatorConfig>): void {
    const existing = this.validators.get(name);
    if (existing) {
      this.validators.set(name, { ...existing, ...config });
    }
  }

  private async runValidatorWithTimeout(
    config: ValidatorConfig,
    input: CrossCheckInput
  ): Promise<CrossCheckResult> {
    const timeoutMs = config.timeoutMs || 10000;

    return Promise.race([
      this.runValidator(config.name, input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  private async runValidator(
    name: string,
    input: CrossCheckInput
  ): Promise<CrossCheckResult> {
    switch (name) {
      case 'wikipedia':
        return this.wikipediaValidator.validate(input);
      case 'google-factcheck':
        return this.googleFactCheckValidator.validate(input);
      case 'newsapi':
        return this.newsApiValidator.validate(input);
      default:
        return this.createErrorResult(name, 'Unknown validator');
    }
  }

  private aggregateResults(
    results: CrossCheckResult[],
    configs: ValidatorConfig[]
  ): CrossCheckAggregate {
    const weights = new Map(configs.map(c => [c.name, c.weight]));

    let verifiedScore = 0;
    let contradictedScore = 0;
    let totalWeight = 0;
    const discrepancies: string[] = [];
    const recommendations: string[] = [];

    for (const result of results) {
      const weight = weights.get(result.source) || 0.1;
      totalWeight += weight;

      if (result.status === 'verified') {
        verifiedScore += result.confidence * weight;
      } else if (result.status === 'contradicted') {
        contradictedScore += result.confidence * weight;
      }

      if (result.status === 'error') {
        discrepancies.push(`${result.source}: ${result.metadata.error}`);
      }
    }

    const normalizedVerified = totalWeight > 0 ? verifiedScore / totalWeight : 0;
    const normalizedContradicted = totalWeight > 0 ? contradictedScore / totalWeight : 0;

    let overallStatus: CrossCheckAggregate['overallStatus'];
    const consensusThreshold = 0.6;

    if (normalizedVerified >= consensusThreshold && normalizedContradicted < 0.2) {
      overallStatus = 'verified';
    } else if (normalizedContradicted >= consensusThreshold && normalizedVerified < 0.2) {
      overallStatus = 'contradicted';
    } else if (normalizedVerified > 0.3 && normalizedContradicted > 0.3) {
      overallStatus = 'disputed';
      discrepancies.push('Conflicting signals from validators');
    } else {
      overallStatus = 'unverified';
    }

    const confidence = Math.max(normalizedVerified, normalizedContradicted);

    if (overallStatus === 'unverified') {
      recommendations.push('Consider manual review - insufficient data for verification');
    }
    if (overallStatus === 'disputed') {
      recommendations.push('Conflicting sources detected - expert review recommended');
    }
    if (results.filter(r => r.status === 'error').length > 1) {
      recommendations.push('Multiple validator errors - check API configurations');
    }

    return {
      overallStatus,
      confidence,
      sourcesChecked: results.map(r => r.source),
      results,
      consensus: this.describeConsensus(normalizedVerified, normalizedContradicted),
      discrepancies,
      recommendations,
    };
  }

  private describeConsensus(verified: number, contradicted: number): string {
    if (verified >= 0.7) {
      return 'Strong consensus for verification';
    } else if (verified >= 0.4) {
      return 'Moderate support for verification';
    } else if (contradicted >= 0.7) {
      return 'Strong consensus against verification';
    } else if (contradicted >= 0.4) {
      return 'Moderate opposition to verification';
    }
    return 'No clear consensus';
  }

  private createErrorResult(source: string, error: string): CrossCheckResult {
    return {
      source,
      status: 'error',
      confidence: 0,
      evidence: [],
      metadata: { error },
      checkedAt: new Date(),
      responseTimeMs: 0,
    };
  }
}
