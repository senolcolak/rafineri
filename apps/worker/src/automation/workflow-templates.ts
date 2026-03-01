/**
 * Pre-built Workflow Templates
 * 
 * Ready-to-use workflow templates for common truth verification scenarios.
 * Similar to n8n workflow templates.
 */

import { WorkflowTemplate } from './automation.types';

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'basic-verification',
    name: 'Basic Verification Flow',
    description: 'Simple 3-step verification: Wikipedia + Google Fact Check + AI Scoring',
    category: 'verification',
    workflow: {
      name: 'Basic Verification',
      description: 'Cross-check with multiple sources',
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: 'Claim Submitted',
          config: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'check-wikipedia',
          type: 'http-request',
          name: 'Check Wikipedia',
          config: {
            method: 'GET',
            url: 'https://en.wikipedia.org/w/api.php',
            queryParams: {
              action: 'query',
              list: 'search',
              srsearch: '{{$data.claim}}',
              format: 'json',
              origin: '*',
            },
            responsePath: 'query.search',
          },
          position: { x: 200, y: -100 },
        },
        {
          id: 'check-google',
          type: 'http-request',
          name: 'Google Fact Check',
          config: {
            method: 'GET',
            url: 'https://factchecktools.googleapis.com/v1alpha1/claims:search',
            queryParams: {
              key: '{{$secrets.GOOGLE_FACTCHECK_API_KEY}}',
              query: '{{$data.claim}}',
              languageCode: 'en',
            },
            responsePath: 'claims',
          },
          position: { x: 200, y: 0 },
        },
        {
          id: 'aggregate',
          type: 'aggregate',
          name: 'Aggregate Results',
          config: {},
          position: { x: 400, y: 0 },
        },
        {
          id: 'decision',
          type: 'condition',
          name: 'Verification Decision',
          config: {
            conditions: [
              { field: 'wikipediaResult.length', operator: 'greater-than', value: 0 },
              { field: 'googleResult.length', operator: 'greater-than', value: 0 },
            ],
            logic: 'OR',
          },
          position: { x: 600, y: 0 },
        },
      ],
      connections: [
        { from: 'trigger', to: 'check-wikipedia' },
        { from: 'trigger', to: 'check-google' },
        { from: 'check-wikipedia', to: 'aggregate' },
        { from: 'check-google', to: 'aggregate' },
        { from: 'aggregate', to: 'decision' },
      ],
      enabled: true,
      trigger: { type: 'manual', config: {} },
    },
  },

  {
    id: 'news-coverage-check',
    name: 'News Coverage Verification',
    description: 'Check if claim is covered by trusted news sources',
    category: 'verification',
    workflow: {
      name: 'News Coverage Check',
      description: 'Verify claim against news coverage',
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: 'Start',
          config: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'search-news',
          type: 'http-request',
          name: 'Search NewsAPI',
          config: {
            method: 'GET',
            url: 'https://newsapi.org/v2/everything',
            queryParams: {
              q: '{{$data.claim}}',
              language: 'en',
              sortBy: 'relevancy',
              apiKey: '{{$secrets.NEWSAPI_KEY}}',
            },
            responsePath: 'articles',
          },
          position: { x: 200, y: 0 },
        },
        {
          id: 'transform',
          type: 'transform',
          name: 'Process Results',
          config: {
            operations: [
              {
                type: 'set',
                config: {
                  path: 'articleCount',
                  value: '{{$data.articles.length}}',
                },
              },
              {
                type: 'set',
                config: {
                  path: 'trustedSources',
                  value: '{{$data.articles.filter(a => ["reuters","bbc-news","associated-press"].includes(a.source.id))}}',
                },
              },
            ],
          },
          position: { x: 400, y: 0 },
        },
        {
          id: 'check-coverage',
          type: 'condition',
          name: 'Check Coverage',
          config: {
            conditions: [
              { field: 'trustedSources.length', operator: 'greater-than', value: 0 },
            ],
            logic: 'AND',
          },
          position: { x: 600, y: 0 },
        },
      ],
      connections: [
        { from: 'trigger', to: 'search-news' },
        { from: 'search-news', to: 'transform' },
        { from: 'transform', to: 'check-coverage' },
      ],
      enabled: true,
      trigger: { type: 'manual', config: {} },
    },
  },

  {
    id: 'curl-validation',
    name: 'Custom Curl Validation',
    description: 'Run custom curl commands to validate against your own APIs',
    category: 'custom',
    workflow: {
      name: 'Curl Validation',
      description: 'HTTP-based validation workflow',
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: 'Start',
          config: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'curl-check',
          type: 'http-request',
          name: 'API Check',
          config: {
            method: 'POST',
            url: '{{$secrets.CUSTOM_API_URL}}',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer {{$secrets.CUSTOM_API_KEY}}',
            },
            body: {
              claim: '{{$data.claim}}',
              timestamp: '{{now()}}',
            },
            responsePath: 'result',
          },
          position: { x: 200, y: 0 },
        },
        {
          id: 'validate',
          type: 'condition',
          name: 'Validate Response',
          config: {
            conditions: [
              { field: 'result.valid', operator: 'equals', value: true },
              { field: 'result.confidence', operator: 'greater-than', value: 0.7 },
            ],
            logic: 'AND',
          },
          position: { x: 400, y: 0 },
        },
      ],
      connections: [
        { from: 'trigger', to: 'curl-check' },
        { from: 'curl-check', to: 'validate' },
      ],
      enabled: true,
      trigger: { type: 'manual', config: {} },
    },
  },

  {
    id: 'bash-script-check',
    name: 'Bash Script Validation',
    description: 'Run custom bash scripts for validation (sandboxed)',
    category: 'custom',
    workflow: {
      name: 'Script Validation',
      description: 'Bash-based validation workflow',
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: 'Start',
          config: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'script',
          type: 'script',
          name: 'Validation Script',
          config: {
            language: 'javascript',
            code: `
              // Custom validation logic
              const claim = $data.claim;
              const keywords = claim.toLowerCase().split(/\\s+/);
              
              // Check for suspicious patterns
              const suspicious = ['clickbait', 'miracle', 'doctors hate'].some(
                s => claim.toLowerCase().includes(s)
              );
              
              return {
                valid: !suspicious,
                keywords: keywords,
                wordCount: keywords.length,
              };
            `,
            timeoutMs: 5000,
          },
          position: { x: 200, y: 0 },
        },
        {
          id: 'check',
          type: 'condition',
          name: 'Check Result',
          config: {
            conditions: [
              { field: 'valid', operator: 'equals', value: true },
              { field: 'wordCount', operator: 'greater-than', value: 5 },
            ],
            logic: 'AND',
          },
          position: { x: 400, y: 0 },
        },
      ],
      connections: [
        { from: 'trigger', to: 'script' },
        { from: 'script', to: 'check' },
      ],
      enabled: true,
      trigger: { type: 'manual', config: {} },
    },
  },

  {
    id: 'approval-notification',
    name: 'Approval Notification',
    description: 'Send notifications when approval status changes',
    category: 'notification',
    workflow: {
      name: 'Notify on Approval',
      description: 'Notification workflow',
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: 'Approval Complete',
          config: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'transform',
          type: 'transform',
          name: 'Format Message',
          config: {
            operations: [
              {
                type: 'set',
                config: {
                  path: 'message',
                  value: 'Story "{{$data.title}}" has been {{$data.status}} with confidence {{$data.confidence}}',
                },
              },
              {
                type: 'set',
                config: {
                  path: 'timestamp',
                  value: '{{now()}}',
                },
              },
            ],
          },
          position: { x: 200, y: 0 },
        },
        {
          id: 'webhook',
          type: 'http-request',
          name: 'Send Webhook',
          config: {
            method: 'POST',
            url: '{{$secrets.WEBHOOK_URL}}',
            headers: {
              'Content-Type': 'application/json',
            },
            body: {
              text: '{{$data.message}}',
              timestamp: '{{$data.timestamp}}',
              storyId: '{{$data.storyId}}',
            },
          },
          position: { x: 400, y: 0 },
        },
      ],
      connections: [
        { from: 'trigger', to: 'transform' },
        { from: 'transform', to: 'webhook' },
      ],
      enabled: true,
      trigger: { type: 'event', config: { event: 'approval.complete' } },
    },
  },

  {
    id: 'full-verification-pipeline',
    name: 'Full Verification Pipeline',
    description: 'Complete verification with all validators and manual review fallback',
    category: 'verification',
    workflow: {
      name: 'Full Verification Pipeline',
      description: 'Comprehensive verification workflow',
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: 'Story Submitted',
          config: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'wikipedia',
          type: 'http-request',
          name: 'Wikipedia Check',
          config: {
            method: 'GET',
            url: 'https://en.wikipedia.org/w/api.php',
            queryParams: {
              action: 'query',
              list: 'search',
              srsearch: '{{$data.claim}}',
              format: 'json',
              origin: '*',
            },
          },
          position: { x: 200, y: -150 },
        },
        {
          id: 'google-factcheck',
          type: 'http-request',
          name: 'Google Fact Check',
          config: {
            method: 'GET',
            url: 'https://factchecktools.googleapis.com/v1alpha1/claims:search',
            queryParams: {
              key: '{{$secrets.GOOGLE_FACTCHECK_API_KEY}}',
              query: '{{$data.claim}}',
            },
          },
          position: { x: 200, y: 0 },
        },
        {
          id: 'newsapi',
          type: 'http-request',
          name: 'News Coverage',
          config: {
            method: 'GET',
            url: 'https://newsapi.org/v2/everything',
            queryParams: {
              q: '{{$data.claim}}',
              apiKey: '{{$secrets.NEWSAPI_KEY}}',
            },
          },
          position: { x: 200, y: 150 },
        },
        {
          id: 'aggregate',
          type: 'aggregate',
          name: 'Collect Results',
          config: {},
          position: { x: 450, y: 0 },
        },
        {
          id: 'evaluate',
          type: 'script',
          name: 'Evaluate Results',
          config: {
            language: 'javascript',
            code: `
              const results = $data.aggregated;
              let score = 0;
              let checks = 0;
              
              // Wikipedia score
              if (results.wikipedia && results.wikipedia.length > 0) {
                score += 0.3;
                checks++;
              }
              
              // Google Fact Check score
              if (results['google-factcheck'] && results['google-factcheck'].claims) {
                score += 0.4;
                checks++;
              }
              
              // NewsAPI score
              if (results.newsapi && results.newsapi.articles) {
                score += 0.2;
                checks++;
              }
              
              return {
                totalScore: score,
                checksCompleted: checks,
                autoApprove: score >= 0.6,
                needsReview: score < 0.3,
              };
            `,
          },
          position: { x: 650, y: 0 },
        },
        {
          id: 'decision',
          type: 'condition',
          name: 'Auto-Approve?',
          config: {
            conditions: [
              { field: 'autoApprove', operator: 'equals', value: true },
            ],
            logic: 'AND',
          },
          position: { x: 850, y: 0 },
        },
        {
          id: 'manual-review-check',
          type: 'condition',
          name: 'Needs Review?',
          config: {
            conditions: [
              { field: 'needsReview', operator: 'equals', value: true },
            ],
            logic: 'AND',
          },
          position: { x: 850, y: 150 },
        },
      ],
      connections: [
        { from: 'trigger', to: 'wikipedia' },
        { from: 'trigger', to: 'google-factcheck' },
        { from: 'trigger', to: 'newsapi' },
        { from: 'wikipedia', to: 'aggregate' },
        { from: 'google-factcheck', to: 'aggregate' },
        { from: 'newsapi', to: 'aggregate' },
        { from: 'aggregate', to: 'evaluate' },
        { from: 'evaluate', to: 'decision' },
        { from: 'evaluate', to: 'manual-review-check' },
      ],
      enabled: true,
      trigger: { type: 'event', config: { event: 'story.submitted' } },
    },
  },
];

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return workflowTemplates.find(t => t.id === id);
}

export function getTemplatesByCategory(category: WorkflowTemplate['category']): WorkflowTemplate[] {
  return workflowTemplates.filter(t => t.category === category);
}
