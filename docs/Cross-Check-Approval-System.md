# Cross-Check & Approval System

> Multi-source verification and n8n-like workflow automation for Rafineri

---

## Overview

The Cross-Check & Approval System provides **multi-source truth verification** through external APIs (Wikipedia, Google Fact Check, NewsAPI) and **workflow automation** (similar to n8n) for custom validation logic.

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVAL WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │ Wikipedia│   │  Google  │   │ NewsAPI  │   │  Custom  │    │
│  │   Check  │   │Fact Check│   │  Check   │   │  HTTP    │    │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘    │
│       └──────────────┴──────────────┴──────────────┘            │
│                      │                                          │
│              ┌───────▼────────┐                                 │
│              │ Cross-Check    │                                 │
│              │ Aggregation    │                                 │
│              └───────┬────────┘                                 │
│                      │                                          │
│              ┌───────▼────────┐                                 │
│              │   AI Scoring   │                                 │
│              └───────┬────────┘                                 │
│                      │                                          │
│              ┌───────▼────────┐                                 │
│              │    Decision    │                                 │
│              │  Auto/Manual   │                                 │
│              └────────────────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Core Components

```
apps/worker/src/
├── cross-check/
│   ├── cross-check.service.ts       # Main orchestrator
│   ├── wikipedia.validator.ts       # Wikipedia API
│   ├── google-factcheck.validator.ts # Google Fact Check
│   ├── newsapi.validator.ts         # News coverage
│   ├── http.validator.ts            # Custom HTTP checks
│   └── cross-check.types.ts         # Type definitions
│
├── automation/
│   ├── automation-engine.service.ts # n8n-like executor
│   ├── workflow-templates.ts        # Pre-built templates
│   └── automation.types.ts          # Type definitions
│
└── approval-workflow/
    ├── approval-workflow.service.ts # Approval orchestration
    └── approval-workflow.module.ts
```

---

## Validators

### 1. Wikipedia Validator

Checks claims against Wikipedia articles using the MediaWiki API.

**Features:**
- Semantic search for relevant articles
- Keyword matching for verification
- Extract relevance scoring

**Example:**
```typescript
const result = await crossCheckService.crossCheck({
  claim: "The Eiffel Tower was completed in 1889",
  keywords: ["Eiffel Tower", "completed", "1889"]
});
// Returns: verified, confidence: 0.85
```

### 2. Google Fact Check Validator

Queries Google's Fact Check Tools API.

**Features:**
- Searches fact-checking articles
- Aggregates publisher ratings
- Weighted confidence scoring

**Configuration:**
```bash
GOOGLE_FACTCHECK_API_KEY=your_api_key
```

### 3. NewsAPI Validator

Checks news coverage from trusted sources.

**Features:**
- Searches recent news articles
- Source credibility weighting
- Coverage diversity analysis

**Trusted Sources:** Reuters, AP, BBC, NYT, WSJ, etc.

**Configuration:**
```bash
NEWSAPI_KEY=your_api_key
```

### 4. HTTP Validator (n8n-like)

Custom HTTP endpoint validation with template variables.

**Features:**
- GET/POST/PUT/PATCH/DELETE methods
- Template variable substitution
- Response path extraction
- Authentication support (Bearer, Basic, API Key)

**Example:**
```typescript
const rules: HttpCheckRule[] = [
  {
    config: {
      name: "Check Custom API",
      method: "POST",
      url: "https://api.example.com/verify",
      headers: { "Authorization": "Bearer {{$secrets.API_KEY}}" },
      body: { claim: "{{$data.claim}}" },
      extractPath: "result.valid"
    },
    validationLogic: "equals",
    expectedValue: "true",
    weight: 0.5
  }
];
```

---

## Automation Engine

### Node Types

| Node Type | Description | Example Use |
|-----------|-------------|-------------|
| `trigger` | Workflow start | Manual, scheduled, webhook |
| `http-request` | HTTP API call | Curl-like requests |
| `condition` | If/else branching | Check confidence threshold |
| `transform` | Data manipulation | Format, map, extract |
| `script` | JavaScript execution | Custom validation logic |
| `bash` | Shell command (sandboxed) | System commands |
| `aggregate` | Collect node outputs | Merge results |
| `webhook` | HTTP endpoint trigger | External integrations |

### Template Variables

Use template syntax to access data:

```javascript
// Access input data
"{{$input.claim}}"

// Access current data
"{{$data.confidence}}"

// Access secrets
"{{$secrets.API_KEY}}"

// Built-in functions
"{{now()}}"           // ISO timestamp
"{{random()}}"        // Random string
```

### Example Workflow

```typescript
const workflow: Workflow = {
  id: "verify-claim",
  name: "Claim Verification",
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      name: "Start",
      config: {},
      position: { x: 0, y: 0 }
    },
    {
      id: "check-api",
      type: "http-request",
      name: "Verify via API",
      config: {
        method: "POST",
        url: "{{$secrets.VERIFICATION_API}}",
        body: { claim: "{{$data.claim}}" }
      },
      position: { x: 200, y: 0 }
    },
    {
      id: "validate",
      type: "condition",
      name: "Check Result",
      config: {
        conditions: [
          { field: "statusCode", operator: "equals", value: 200 },
          { field: "data.valid", operator: "equals", value: true }
        ],
        logic: "AND"
      },
      position: { x: 400, y: 0 }
    }
  ],
  connections: [
    { from: "trigger", to: "check-api" },
    { from: "check-api", to: "validate" }
  ],
  enabled: true,
  trigger: { type: "manual", config: {} },
  createdAt: new Date(),
  updatedAt: new Date()
};
```

---

## Pre-built Templates

### 1. Basic Verification Flow
Simple 3-step verification: Wikipedia + Google Fact Check + aggregation.

### 2. News Coverage Check
Verify claim against trusted news sources.

### 3. Custom Curl Validation
Run custom HTTP requests against your APIs.

### 4. Bash Script Validation
Execute JavaScript for custom logic.

### 5. Full Verification Pipeline
Complete pipeline with all validators and decision logic.

**Usage:**
```typescript
import { getTemplateById } from './automation/workflow-templates';

const template = getTemplateById('full-verification-pipeline');
const execution = await automationEngine.executeWorkflow(
  template.workflow,
  { claim: "Your claim here" },
  { API_KEY: 'secret' }
);
```

---

## Approval Workflow

### Process Flow

```
Story Submitted
      │
      ▼
┌─────────────┐
│ Cross-Check │ ──→ Wikipedia, Google, NewsAPI
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  AI Scoring │ ──→ Local LLM scoring
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Automation │ ──→ Custom HTTP/Bash/Script
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Decision  │
└──────┬──────┘
       │
   ┌───┴───┐
   ▼       ▼
┌────┐  ┌────┐  ┌────────┐
│ ✅ │  │ ❌ │  │ 👤     │
│Pass│  │Fail│  │Manual  │
└────┘  └────┘  └────────┘
```

### Auto-Approve Criteria
- Cross-check: `verified` status
- AI score: `verified` or `likely-true`
- Confidence: ≥ 0.75

### Auto-Reject Criteria
- Cross-check: `contradicted` status
- AI score: `likely-fake`

### Escalation Criteria
- Cross-check: `disputed` status
- Low confidence across validators

---

## API Endpoints

### Submit for Approval
```http
POST /v1/admin/approval/submit
Content-Type: application/json
X-Admin-Token: your-token

{
  "storyId": "story-123",
  "title": "Breaking News",
  "claim": "The claim to verify",
  "sources": ["https://source1.com"]
}
```

### Process with Custom Rules
```http
POST /v1/admin/approval/process-with-rules
Content-Type: application/json
X-Admin-Token: your-token

{
  "storyId": "story-123",
  "title": "Breaking News",
  "claim": "The claim",
  "httpRules": [
    {
      "config": {
        "name": "Custom Check",
        "url": "https://api.example.com/verify",
        "method": "POST",
        "body": { "claim": "{{claim}}" }
      },
      "validationLogic": "contains",
      "expectedValue": "valid",
      "weight": 0.5
    }
  ]
}
```

### Run Cross-Check Only
```http
POST /v1/admin/approval/cross-check
Content-Type: application/json
X-Admin-Token: your-token

{
  "claim": "The claim to verify",
  "context": "Additional context",
  "keywords": ["keyword1", "keyword2"]
}

Response:
{
  "success": true,
  "data": {
    "overallStatus": "verified",
    "confidence": 0.75,
    "sourcesChecked": ["wikipedia", "google-factcheck", "newsapi"],
    "results": [...],
    "consensus": "Moderate support for verification",
    "recommendations": []
  }
}
```

### Execute Workflow
```http
POST /v1/admin/approval/workflows/:id/execute
Content-Type: application/json
X-Admin-Token: your-token

{
  "claim": "Your claim",
  "storyId": "story-123"
}
```

---

## Configuration

### Environment Variables

```bash
# Google Fact Check API
GOOGLE_FACTCHECK_API_KEY=your_key_here

# NewsAPI
NEWSAPI_KEY=your_key_here

# Custom API endpoints (for HTTP validator)
CUSTOM_API_URL=https://your-api.com/verify
CUSTOM_API_KEY=your_key

# Webhook for notifications
WEBHOOK_URL=https://hooks.slack.com/your/webhook
```

### Validator Weights

Default weights (configurable):

| Validator | Weight | Description |
|-----------|--------|-------------|
| Wikipedia | 0.3 | Knowledge base verification |
| Google Fact Check | 0.4 | Professional fact-checking |
| NewsAPI | 0.2 | News coverage |
| HTTP Validator | 0.1 | Custom checks |

---

## Usage Examples

### Basic Cross-Check

```typescript
import { CrossCheckService } from './cross-check';

const result = await crossCheckService.crossCheck({
  claim: "Mars has two moons",
  keywords: ["Mars", "moons", "Phobos", "Deimos"]
});

console.log(result.overallStatus);  // "verified"
console.log(result.confidence);     // 0.82
```

### Approval with Custom HTTP Rules

```typescript
import { ApprovalWorkflowService } from './approval-workflow';

const result = await approvalWorkflow.processWithHttpRules(
  {
    storyId: "story-123",
    title: "News Title",
    claim: "The claim",
  },
  [
    {
      config: {
        name: "FactCheckDB",
        url: "https://factcheck.example.com/api/verify",
        method: "POST",
        headers: { "X-API-Key": "{{$secrets.FACTCHECK_KEY}}" },
        body: { query: "{{$data.claim}}" },
        extractPath: "verified"
      },
      validationLogic: "equals",
      expectedValue: "true",
      weight: 0.6
    }
  ]
);

console.log(result.approved);   // true/false
console.log(result.status);     // "approved" | "rejected" | "escalated"
```

### Custom Workflow Execution

```typescript
import { AutomationEngineService } from './automation';
import { getTemplateById } from './automation/workflow-templates';

const template = getTemplateById('bash-script-check');
const execution = await automationEngine.executeWorkflow(
  template.workflow,
  { claim: "Test claim" },
  {}
);

console.log(execution.status);      // "completed"
console.log(execution.nodeExecutions);
```

---

## Bash/Script Security

### Sandboxing

- JavaScript runs in isolated VM context
- No access to `require()`, `process`, or filesystem
- Timeout enforced (default: 5s)

### Bash Restrictions

- Must enable explicitly: `allowUnsafe: true`
- Dangerous patterns blocked (rm -rf, curl | sh, etc.)
- Working directory restrictions
- Timeout enforced (default: 30s)

### Safe Script Example

```typescript
const scriptNode = {
  type: "script",
  config: {
    language: "javascript",
    code: `
      // Safe: Only access provided data
      const claim = $data.claim;
      const words = claim.split(/\\s+/);
      
      return {
        wordCount: words.length,
        hasNumbers: /\\d/.test(claim),
        safe: true
      };
    `,
    timeoutMs: 5000
  }
};
```

---

## Monitoring & Debugging

### Execution Logs

Each node execution includes:
- Input/output data
- Execution time
- Error messages
- Status (pending, running, completed, failed)

### Health Check

```http
GET /v1/admin/health
```

Returns validator status:
```json
{
  "validators": {
    "wikipedia": "healthy",
    "google-factcheck": "healthy",
    "newsapi": "healthy",
    "http-validator": "healthy"
  }
}
```

---

## Best Practices

1. **Use Multiple Validators**
   - Don't rely on a single source
   - Configure appropriate weights

2. **Set Confidence Thresholds**
   - Auto-approve: ≥ 0.75
   - Auto-reject: ≤ 0.3
   - Manual review: 0.3 - 0.75

3. **Custom Rules for Domain-Specific Checks**
   - Use HTTP validator for industry APIs
   - Create workflow templates for common patterns

4. **Monitor API Limits**
   - Google Fact Check: 1000 requests/day (free tier)
   - NewsAPI: 100 requests/day (free tier)

5. **Cache Results**
   - Cross-check results cached by claim hash
   - Reduces API calls and improves performance

---

## Integration with Existing Scoring

The cross-check system integrates with the existing scoring pipeline:

```
Story Ingestion
      │
      ▼
┌─────────────┐
│  Existing   │
│   Scoring   │ ←─ Rule-based + AI Scoring
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Cross-Check │ ←─ NEW: Multi-source verification
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Aggregate  │ ←─ Combined confidence score
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Decision   │ ←─ Auto/Manual approval
└─────────────┘
```

---

## Future Enhancements

1. **More Validators**
   - Snopes API
   - Politifact API
   - Academic databases

2. **Workflow Visual Editor**
   - Drag-and-drop interface
   - Real-time execution view

3. **ML-Based Aggregation**
   - Learn optimal weights
   - Detect validator bias

4. **Collaborative Review**
   - Multi-user approval
   - Expert reviewer pools

---

## Summary

The Cross-Check & Approval System provides:

✅ **Multi-source verification** (Wikipedia, Google Fact Check, NewsAPI)  
✅ **Custom HTTP validation** (n8n-like curl/json scripting)  
✅ **Workflow automation** with pre-built templates  
✅ **Approval workflow** with auto/manual decisions  
✅ **Sandboxed scripting** (JavaScript + Bash)  
✅ **Admin API** for management and monitoring  

**Next:** See `docs/Testing-Guide.md` for testing the cross-check system.
