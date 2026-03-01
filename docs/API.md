# Rafineri API Documentation

Complete reference for the Rafineri REST API.

**Base URL**: `http://localhost:3001/api/v1`  
**Swagger UI**: `http://localhost:3001/docs`

---

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Common Patterns](#common-patterns)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Stories](#stories)
  - [Admin](#admin)
- [Error Responses](#error-responses)

---

## Authentication

### Public Endpoints

Most read-only endpoints do not require authentication:
- `GET /health`
- `GET /stories`
- `GET /stories/:id`

### Admin Endpoints

All `/admin/*` endpoints require authentication via Bearer token:

```http
Authorization: Bearer <ADMIN_TOKEN>
```

The admin token is configured via the `ADMIN_TOKEN` environment variable.

### Example

```bash
curl -H "Authorization: Bearer dev-admin-token" \
  http://localhost:3001/api/v1/admin/stories
```

---

## Rate Limiting

API requests are rate-limited to prevent abuse:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Public read | 100 requests | 1 minute |
| Admin write | 30 requests | 1 minute |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312800
```

When exceeded, the API returns `429 Too Many Requests`.

---

## Common Patterns

### Pagination

List endpoints support offset-based pagination:

| Parameter | Type | Default | Max |
|-----------|------|---------|-----|
| `limit` | integer | 20 | 100 |
| `offset` | integer | 0 | - |

Example:
```http
GET /stories?limit=20&offset=40
```

### Sorting

Use the `sort` parameter to control ordering:

```http
GET /stories?sort=hot          # Trending/hot stories
GET /stories?sort=newest       # Most recent first
GET /stories?sort=most_verified    # Highest confidence verified
GET /stories?sort=most_contested   # Most disputed
```

### Filtering

| Parameter | Type | Description |
|-----------|------|-------------|
| `label` | string | Filter by verifiability: `verified`, `likely`, `contested`, `unverified` |
| `search` | string | Text search in title/summary |

Example:
```http
GET /stories?label=verified&search=climate
```

### Response Format

All responses follow a consistent envelope structure:

**Success (200-299)**:
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**List Response**:
```json
{
  "data": [ ... ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Endpoints

### Health

#### Check API Health

```http
GET /health
```

Returns the health status of the API and its dependencies.

**Response (200 OK)**:
```json
{
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0",
    "services": {
      "database": "connected",
      "redis": "connected"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Response (503 Service Unavailable)** - When dependencies are down:
```json
{
  "data": {
    "status": "unhealthy",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "version": "1.0.0",
    "services": {
      "database": "disconnected",
      "redis": "connected"
    }
  },
  "meta": { ... }
}
```

---

### Stories

#### List Stories

```http
GET /stories
```

Retrieve a paginated list of stories with optional filtering and sorting.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Items per page (default: 20, max: 100) |
| `offset` | integer | No | Offset for pagination (default: 0) |
| `sort` | string | No | Sort order: `hot`, `newest`, `most_verified`, `most_contested` |
| `label` | string | No | Filter by label: `verified`, `likely`, `contested`, `unverified` |
| `search` | string | No | Text search in title/summary |

**Example Request**:
```bash
curl "http://localhost:3001/api/v1/stories?limit=10&sort=hot&label=verified"
```

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "story_abc123",
      "title": "Major Breakthrough in Quantum Computing Achieved",
      "summary": "Researchers at MIT have demonstrated a 1000-qubit quantum processor...",
      "label": "verified",
      "confidence": 0.92,
      "thumbnailUrl": "https://cdn.example.com/thumbs/abc123.jpg",
      "firstSeenAt": "2024-01-15T08:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "itemCount": 12,
      "claimCount": 3
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

#### Get Story Details

```http
GET /stories/:id
```

Retrieve detailed information about a specific story, including related items, claims, and evidence.

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Story unique identifier |

**Example Request**:
```bash
curl "http://localhost:3001/api/v1/stories/story_abc123"
```

**Response (200 OK)**:
```json
{
  "data": {
    "id": "story_abc123",
    "title": "Major Breakthrough in Quantum Computing Achieved",
    "summary": "Researchers at MIT have demonstrated a 1000-qubit quantum processor that maintains coherence for over 10 minutes at room temperature, marking a significant milestone in practical quantum computing.",
    "label": "verified",
    "confidence": 0.92,
    "thumbnailUrl": "https://cdn.example.com/thumbs/abc123.jpg",
    "firstSeenAt": "2024-01-15T08:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T08:00:00.000Z",
    "items": [
      {
        "id": "item_xyz789",
        "sourceType": "hackernews",
        "externalId": "39012345",
        "url": "https://news.mit.edu/2024/quantum-breakthrough",
        "title": "MIT researchers achieve quantum computing milestone",
        "content": "Full article content...",
        "author": "mit_news",
        "score": 2847,
        "postedAt": "2024-01-15T07:30:00.000Z"
      }
    ],
    "claims": [
      {
        "id": "claim_def456",
        "text": "MIT demonstrated a 1000-qubit quantum processor",
        "type": "fact",
        "status": "verified",
        "createdAt": "2024-01-15T08:15:00.000Z"
      }
    ],
    "evidence": [
      {
        "id": "evidence_ghi789",
        "url": "https://www.nature.com/articles/s41586-024-07111-7",
        "title": "Room-temperature quantum coherence in a 1000-qubit processor",
        "stance": "supporting",
        "snippet": "We demonstrate coherent control of 1000 qubits at 300K...",
        "createdAt": "2024-01-15T08:30:00.000Z"
      }
    ],
    "events": [
      {
        "id": "event_jkl012",
        "eventType": "created",
        "data": { "source": "clustering_pipeline" },
        "createdAt": "2024-01-15T08:00:00.000Z"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Response (404 Not Found)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Story not found",
    "details": {
      "id": "story_abc123"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### Admin

All admin endpoints require authentication.

#### List All Stories (Admin)

```http
GET /admin/stories
```

Admin version of story listing with additional fields and no caching.

**Headers**:
```http
Authorization: Bearer <ADMIN_TOKEN>
```

**Query Parameters**: Same as public `/stories` endpoint.

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "story_abc123",
      "title": "Major Breakthrough in Quantum Computing Achieved",
      "summary": "Researchers at MIT have demonstrated...",
      "label": "verified",
      "confidence": 0.92,
      "thumbnailUrl": "https://cdn.example.com/thumbs/abc123.jpg",
      "firstSeenAt": "2024-01-15T08:00:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T08:00:00.000Z",
      "itemCount": 12,
      "claimCount": 3,
      "evidenceCount": 2,
      "isPublished": true
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  },
  "meta": { ... }
}
```

**Response (401 Unauthorized)**:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing authentication token"
  },
  "meta": { ... }
}
```

---

#### Create Story

```http
POST /admin/stories
```

Manually create a new story (typically used for testing or manual curation).

**Headers**:
```http
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Story title (1-500 chars) |
| `summary` | string | No | Story summary (max 5000 chars) |
| `label` | string | No | Initial label: `verified`, `likely`, `contested`, `unverified` |
| `confidence` | number | No | Confidence score 0-1 |
| `thumbnailUrl` | string | No | URL to thumbnail image |
| `itemIds` | string[] | No | IDs of existing items to link |

**Example Request**:
```bash
curl -X POST "http://localhost:3001/api/v1/admin/stories" \
  -H "Authorization: Bearer dev-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Scientific Discovery Announced",
    "summary": "Researchers have discovered...",
    "label": "likely",
    "confidence": 0.75
  }'
```

**Response (201 Created)**:
```json
{
  "data": {
    "id": "story_new789",
    "title": "New Scientific Discovery Announced",
    "summary": "Researchers have discovered...",
    "label": "likely",
    "confidence": 0.75,
    "thumbnailUrl": null,
    "firstSeenAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "items": [],
    "claims": [],
    "evidence": []
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Response (400 Bad Request)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "title",
        "message": "Title is required and must be between 1 and 500 characters"
      }
    ]
  },
  "meta": { ... }
}
```

---

#### Update Story

```http
PATCH /admin/stories/:id
```

Update an existing story's properties.

**Headers**:
```http
Authorization: Bearer <ADMIN_TOKEN>
Content-Type: application/json
```

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Story unique identifier |

**Request Body**:

All fields are optional. Only provided fields will be updated.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Story title |
| `summary` | string | Story summary |
| `label` | string | Verifiability label |
| `confidence` | number | Confidence score 0-1 |
| `thumbnailUrl` | string | Thumbnail URL (null to remove) |

**Example Request**:
```bash
curl -X PATCH "http://localhost:3001/api/v1/admin/stories/story_abc123" \
  -H "Authorization: Bearer dev-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "verified",
    "confidence": 0.95
  }'
```

**Response (200 OK)**:
```json
{
  "data": {
    "id": "story_abc123",
    "title": "Major Breakthrough in Quantum Computing Achieved",
    "summary": "Researchers at MIT have demonstrated...",
    "label": "verified",
    "confidence": 0.95,
    "thumbnailUrl": "https://cdn.example.com/thumbs/abc123.jpg",
    "firstSeenAt": "2024-01-15T08:00:00.000Z",
    "updatedAt": "2024-01-15T10:35:00.000Z",
    "createdAt": "2024-01-15T08:00:00.000Z"
  },
  "meta": { ... }
}
```

**Response (404 Not Found)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Story not found"
  },
  "meta": { ... }
}
```

---

#### Delete Story

```http
DELETE /admin/stories/:id
```

Permanently delete a story and its associated data.

**⚠️ Warning**: This action is irreversible.

**Headers**:
```http
Authorization: Bearer <ADMIN_TOKEN>
```

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Story unique identifier |

**Example Request**:
```bash
curl -X DELETE "http://localhost:3001/api/v1/admin/stories/story_abc123" \
  -H "Authorization: Bearer dev-admin-token"
```

**Response (204 No Content)**:

Empty body on successful deletion.

**Response (404 Not Found)**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Story not found"
  },
  "meta": { ... }
}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": {} // Optional additional context
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `BAD_REQUEST` | 400 | Malformed request |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Dependency unavailable |

### Common Error Examples

**Validation Error (400)**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "confidence",
        "message": "Confidence must be between 0 and 1",
        "value": 1.5
      }
    ]
  },
  "meta": { ... }
}
```

**Rate Limited (429)**:
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfter": 60
    }
  },
  "meta": { ... }
}
```

**Internal Error (500)**:
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  },
  "meta": { ... }
}
```

---

## TypeScript Types

For TypeScript projects, use these types from the `@rafineri/shared` package:

```typescript
import { Story, StoryWithRelations, Item, Claim, Evidence } from '@rafineri/shared/types';
import { PaginatedResponse } from '@rafineri/shared/types';

// Story list response
type StoriesResponse = PaginatedResponse<Story>;

// Story detail response
type StoryDetailResponse = StoryWithRelations;
```

See [`/packages/shared/src/types/index.ts`](/packages/shared/src/types/index.ts) for complete type definitions.
