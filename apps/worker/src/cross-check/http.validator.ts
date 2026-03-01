/**
 * HTTP/Curl Validator
 * 
 * Generic HTTP-based validator for custom cross-checks.
 * Supports configurable endpoints, headers, and response parsing.
 * Similar to n8n HTTP request node.
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  CrossCheckInput,
  CrossCheckResult,
  CrossCheckEvidence,
} from './cross-check.types';

export interface HttpCheckConfig {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;
  extractPath?: string;
  matchPattern?: string;
  timeoutMs?: number;
}

export interface HttpCheckRule {
  config: HttpCheckConfig;
  validationLogic: 'contains' | 'equals' | 'exists' | 'regex';
  expectedValue?: string;
  weight: number;
}

@Injectable()
export class HttpValidator {
  private readonly logger = new Logger(HttpValidator.name);

  constructor(private readonly httpService: HttpService) {}

  async validateWithRules(
    input: CrossCheckInput,
    rules: HttpCheckRule[]
  ): Promise<CrossCheckResult> {
    const startTime = Date.now();
    const results: Array<{ rule: string; passed: boolean; value: unknown }> = [];
    const evidence: CrossCheckEvidence[] = [];

    for (const rule of rules) {
      try {
        const result = await this.executeHttpCheck(input, rule.config);
        const passed = this.validateResult(result, rule);
        
        results.push({
          rule: rule.config.name,
          passed,
          value: result,
        });

        if (passed) {
          evidence.push({
            type: 'url',
            value: rule.config.url,
            source: rule.config.name,
            relevance: rule.weight,
          });
        }
      } catch (error) {
        this.logger.error(`HTTP check failed for ${rule.config.name}: ${error.message}`);
        results.push({
          rule: rule.config.name,
          passed: false,
          value: error.message,
        });
      }
    }

    // Aggregate results
    const passedChecks = results.filter(r => r.passed).length;
    const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0);
    const passedWeight = rules
      .filter((r, i) => results[i]?.passed)
      .reduce((sum, r) => sum + r.weight, 0);
    
    const score = totalWeight > 0 ? passedWeight / totalWeight : 0;
    
    let status: 'verified' | 'contradicted' | 'unverified';
    if (score >= 0.7) {
      status = 'verified';
    } else if (score <= 0.3) {
      status = 'contradicted';
    } else {
      status = 'unverified';
    }

    return {
      source: 'http-validator',
      status,
      confidence: score,
      evidence,
      metadata: {
        checksRun: rules.length,
        checksPassed: passedChecks,
        checkResults: results,
        score,
      },
      checkedAt: new Date(),
      responseTimeMs: Date.now() - startTime,
    };
  }

  private async executeHttpCheck(
    input: CrossCheckInput,
    config: HttpCheckConfig
  ): Promise<unknown> {
    // Build URL with query params
    const url = new URL(config.url);
    if (config.queryParams) {
      for (const [key, value] of Object.entries(config.queryParams)) {
        // Replace template variables
        const replacedValue = this.replaceTemplateVars(value, input);
        url.searchParams.set(key, replacedValue);
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...config.headers,
    };

    // Build body for POST
    let body: unknown = undefined;
    if (config.method === 'POST' && config.body) {
      body = this.replaceTemplateVarsInObject(config.body, input);
    }

    const timeout = config.timeoutMs || 10000;

    // Make request
    const response = await firstValueFrom(
      config.method === 'GET'
        ? this.httpService.get(url.toString(), { headers, timeout })
        : this.httpService.post(url.toString(), body, { headers, timeout })
    );

    // Extract value from response
    let result = response.data;
    if (config.extractPath) {
      result = this.extractValueByPath(result, config.extractPath);
    }

    return result;
  }

  private validateResult(result: unknown, rule: HttpCheckRule): boolean {
    switch (rule.validationLogic) {
      case 'contains':
        if (typeof result === 'string' && rule.expectedValue) {
          return result.toLowerCase().includes(rule.expectedValue.toLowerCase());
        }
        return false;
        
      case 'equals':
        return String(result) === String(rule.expectedValue);
        
      case 'exists':
        return result !== undefined && result !== null;
        
      case 'regex':
        if (typeof result === 'string' && rule.expectedValue) {
          const regex = new RegExp(rule.expectedValue, 'i');
          return regex.test(result);
        }
        return false;
        
      default:
        return false;
    }
  }

  private replaceTemplateVars(template: string, input: CrossCheckInput): string {
    return template
      .replace(/\{\{claim\}\}/g, input.claim)
      .replace(/\{\{context\}\}/g, input.context || '')
      .replace(/\{\{keywords\}\}/g, (input.keywords || []).join(' '));
  }

  private replaceTemplateVarsInObject(obj: unknown, input: CrossCheckInput): unknown {
    if (typeof obj === 'string') {
      return this.replaceTemplateVars(obj, input);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceTemplateVarsInObject(item, input));
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceTemplateVarsInObject(value, input);
      }
      return result;
    }
    return obj;
  }

  private extractValueByPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        current = current[parseInt(part)];
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }
}
