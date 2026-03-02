/**
 * HTTP Validator
 * 
 * Validates claims against custom HTTP endpoints.
 */

import { Injectable, Logger } from '@nestjs/common';
import { CrossCheckInput, CrossCheckResult, CrossCheckEvidence, HttpCheckRule } from './cross-check.types';

@Injectable()
export class HttpValidator {
  private readonly logger = new Logger(HttpValidator.name);

  async validate(input: CrossCheckInput): Promise<CrossCheckResult> {
    // Default validation - no rules configured
    return {
      source: 'http-validator',
      status: 'unverified',
      confidence: 0,
      evidence: [],
      metadata: { message: 'No HTTP validation rules configured' },
      checkedAt: new Date(),
      responseTimeMs: 0,
    };
  }

  async validateWithRules(input: CrossCheckInput, rules: HttpCheckRule[]): Promise<CrossCheckResult> {
    const startTime = Date.now();
    const results: Array<{ rule: string; passed: boolean; responseTime: number }> = [];
    let passedCount = 0;

    for (const rule of rules) {
      try {
        const result = await this.checkRule(rule, input);
        results.push(result);
        if (result.passed) passedCount++;
      } catch (error) {
        this.logger.error(`HTTP rule '${rule.name}' failed: ${error.message}`);
        results.push({ rule: rule.name, passed: false, responseTime: 0 });
      }
    }

    const totalRules = rules.length;
    const passRate = totalRules > 0 ? passedCount / totalRules : 0;

    // Determine status based on pass rate
    let status: CrossCheckResult['status'] = 'unverified';
    if (passRate >= 0.8) {
      status = 'verified';
    } else if (passRate >= 0.5) {
      status = 'unverified'; // Partial pass
    } else if (passRate > 0) {
      status = 'contradicted';
    }

    const evidence: CrossCheckEvidence[] = results.map(r => ({
      type: 'text',
      value: `${r.rule}: ${r.passed ? 'PASSED' : 'FAILED'} (${r.responseTime}ms)`,
      source: 'http-validator',
      relevance: r.passed ? 0.8 : 0.4,
    }));

    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length || 0;

    return {
      source: 'http-validator',
      status,
      confidence: passRate,
      evidence,
      metadata: {
        rulesChecked: totalRules,
        passed: passedCount,
        failed: totalRules - passedCount,
        details: results,
      },
      checkedAt: new Date(),
      responseTimeMs: Date.now() - startTime,
    };
  }

  async testRule(rule: HttpCheckRule, testValue?: string): Promise<{ name: string; passed: boolean; responseTime: number; extractedValue?: string; matched?: boolean }> {
    const startTime = Date.now();

    try {
      const url = new URL(rule.url);
      
      // Add query params
      if (rule.queryParams) {
        Object.entries(rule.queryParams).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const fetchOptions: RequestInit = {
        method: rule.method,
        headers: rule.headers || {},
      };

      if (rule.method === 'POST' && rule.body) {
        fetchOptions.body = typeof rule.body === 'string' ? rule.body : JSON.stringify(rule.body);
        if (!fetchOptions.headers || !('Content-Type' in fetchOptions.headers)) {
          fetchOptions.headers = { ...fetchOptions.headers, 'Content-Type': 'application/json' };
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), rule.timeoutMs || 10000);

      const response = await fetch(url.toString(), {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      let responseData: unknown;

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Extract value using path if specified
      let extractedValue: string | undefined;
      if (rule.extractPath) {
        extractedValue = this.extractValue(responseData, rule.extractPath);
      }

      // Validate based on logic
      let matched = false;
      const valueToCheck = extractedValue || JSON.stringify(responseData);

      switch (rule.validationLogic) {
        case 'contains':
          matched = valueToCheck.includes(rule.expectedValue || '');
          break;
        case 'equals':
          matched = valueToCheck === rule.expectedValue;
          break;
        case 'exists':
          matched = !!extractedValue;
          break;
        case 'regex':
          if (rule.matchPattern) {
            const regex = new RegExp(rule.matchPattern);
            matched = regex.test(valueToCheck);
          }
          break;
        default:
          matched = response.ok;
      }

      return {
        name: rule.name,
        passed: matched,
        responseTime,
        extractedValue,
        matched,
      };
    } catch (error) {
      return {
        name: rule.name,
        passed: false,
        responseTime: Date.now() - startTime,
        matched: false,
      };
    }
  }

  private async checkRule(rule: HttpCheckRule, input: CrossCheckInput): Promise<{ rule: string; passed: boolean; responseTime: number }> {
    const result = await this.testRule(rule, input.claim);
    return {
      rule: rule.name,
      passed: result.passed,
      responseTime: result.responseTime,
    };
  }

  private extractValue(data: unknown, path: string): string {
    const parts = path.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current && typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return '';
      }
    }

    return String(current || '');
  }
}
