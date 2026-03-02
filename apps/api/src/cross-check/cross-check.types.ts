/**
 * Cross-Check Types
 * 
 * Multi-source verification system for truth validation
 */

export interface CrossCheckEvidence {
  type: 'url' | 'text' | 'score' | 'snippet';
  value: string;
  source: string;
  relevance: number;
}

export interface CrossCheckResult {
  source: string;
  status: 'verified' | 'contradicted' | 'unverified' | 'error';
  confidence: number;
  evidence: CrossCheckEvidence[];
  metadata: Record<string, unknown>;
  checkedAt: Date;
  responseTimeMs: number;
}

export interface CrossCheckInput {
  claim: string;
  context?: string;
  keywords?: string[];
  existingSources?: string[];
}

export interface CrossCheckAggregate {
  overallStatus: 'verified' | 'contradicted' | 'unverified' | 'disputed';
  confidence: number;
  sourcesChecked: string[];
  results: CrossCheckResult[];
  consensus: string;
  discrepancies: string[];
  recommendations: string[];
}

export interface ValidatorConfig {
  name: string;
  enabled: boolean;
  weight: number;
  timeoutMs: number;
  apiKey?: string;
  baseUrl?: string;
  priority: number;
}

export interface WikipediaResult {
  pageId: number;
  title: string;
  extract: string;
  url: string;
  relevanceScore: number;
}

export interface GoogleFactCheckResult {
  claimant: string;
  claimDate: string;
  claimReview: Array<{
    publisher: { name: string; site: string };
    url: string;
    title: string;
    reviewDate: string;
    textualRating: string;
    languageCode: string;
  }>;
}

export interface NewsSearchResult {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  snippet: string;
  relevanceScore: number;
}

export interface HttpCheckRule {
  name: string;
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;
  extractPath?: string;
  matchPattern?: string;
  timeoutMs?: number;
  validationLogic?: 'contains' | 'equals' | 'exists' | 'regex';
  expectedValue?: string;
}
