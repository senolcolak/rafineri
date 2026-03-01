# Rafineri Architecture

This document describes the high-level architecture of the Rafineri platform, including system components, data flow, and design decisions.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RAFINERI PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌─────────────────────────────────────────────────┐  │
│  │   EXTERNAL   │     │              PROCESSING LAYER                    │  │
│  │   SOURCES    │     │  ┌─────────┐  ┌──────────┐  ┌────────────────┐ │  │
│  │              │     │  │         │  │          │  │                │ │  │
│  │  ┌────────┐  │────▶│  │INGESTION│──│ CLUSTER  │──│     SCORE      │ │  │
│  │  │Hacker  │  │     │  │ WORKER  │  │ WORKER   │  │    WORKER      │ │  │
│  │  │ News   │  │     │  │         │  │          │  │                │ │  │
│  │  └────────┘  │     │  └────┬────┘  └────┬─────┘  └────────┬───────┘ │  │
│  │              │     │       │            │                 │         │  │
│  │  ┌────────┐  │     │  ┌────▼────────────▼─────────────────▼─────┐   │  │
│  │  │Reddit  │  │     │  │           REDIS QUEUES                  │   │  │
│  │  │        │  │────▶│  │  • ingestion-queue                      │   │  │
│  │  └────────┘  │     │  │  • clustering-queue                     │   │  │
│  │              │     │  │  • scoring-queue                        │   │  │
│  └──────────────┘     │  └─────────────────────────────────────────┘   │  │
│                       └─────────────────────────────────────────────────┘  │
│                                        │                                    │
│                                        ▼                                    │
│                       ┌─────────────────────────────────────────────────┐  │
│                       │            STORAGE LAYER                       │  │
│                       │  ┌─────────────────┐  ┌─────────────────────┐ │  │
│                       │  │                 │  │                     │ │  │
│                       │  │   POSTGRESQL    │  │       REDIS         │ │  │
│                       │  │                 │  │                     │ │  │
│                       │  │  • stories      │  │  • Job queues       │ │  │
│                       │  │  • items        │  │  • Caching          │ │  │
│                       │  │  • claims       │  │  • Rate limiting    │ │  │
│                       │  │  • evidence     │  │  • Sessions         │ │  │
│                       │  │  • events       │  │                     │ │  │
│                       │  │                 │  │                     │ │  │
│                       │  └─────────────────┘  └─────────────────────┘ │  │
│                       └─────────────────────────────────────────────────┘  │
│                                        │                                    │
│                                        ▼                                    │
│  ┌──────────────┐     ┌─────────────────────────────────────────────────┐  │
│  │    CLIENT    │     │              API LAYER                         │  │
│  │              │     │  ┌─────────────────────────────────────────┐   │  │
│  │  ┌────────┐  │     │  │           NESTJS API                     │   │  │
│  │  │  Web   │◀ │◀────│  │  ┌─────────┐ ┌─────────┐ ┌─────────────┐│   │  │
│  │  │  App   │  │     │  │  │ Stories │ │  Admin  │ │   Health    ││   │  │
│  │  │ (Next) │  │     │  │  │  API    │ │  API    │ │   Check     ││   │  │
│  │  └────────┘  │     │  │  └─────────┘ └─────────┘ └─────────────┘│   │  │
│  │              │     │  │                                           │   │  │
│  │  ┌────────┐  │     │  │  Features:                                │   │  │
│  │  │ Mobile │◀ │◀────│  │  • RESTful endpoints                      │   │  │
│  │  │  App   │  │     │  │  • Swagger documentation                  │   │  │
│  │  └────────┘  │     │  │  • Rate limiting                          │   │  │
│  └──────────────┘     │  │  • CORS enabled                           │   │  │
│                       │  └─────────────────────────────────────────┘   │  │
│                       └─────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Ingestion → 2. Clustering → 3. Scoring → 4. Serving

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │
│ INGESTION   │────▶│ CLUSTERING  │────▶│   SCORING   │────▶│   SERVING   │
│             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
  ┌─────────┐        ┌─────────┐        ┌─────────┐          ┌─────────┐
  │ Fetch   │        │ Embed   │        │  LLM    │          │  REST   │
  │ from    │        │ content │        │ analysis│          │  API    │
  │ sources │        │         │        │         │          │         │
  └────┬────┘        └────┬────┘        └────┬────┘          └────┬────┘
       │                  │                  │                     │
       ▼                  ▼                  ▼                     ▼
  ┌─────────┐        ┌─────────┐        ┌─────────┐          ┌─────────┐
  │ Store   │        │Compare  │        │Assign   │          │  Web    │
  │ items   │        │with     │        │labels   │          │ Frontend│
  │ in DB   │        │existing │        │& scores │          │         │
  └─────────┘        │stories  │        └─────────┘          └─────────┘
                     └─────────┘
```

### Detailed Flow

**1. Ingestion Phase**
- Worker polls external sources (Hacker News, Reddit) on scheduled intervals
- Fetches new items (posts, comments, articles)
- Normalizes and stores in `items` table
- Enqueues items for clustering

**2. Clustering Phase**
- Consumes items from clustering queue
- Generates embeddings for content
- Compares with existing story embeddings
- Groups related items into stories
- Creates or updates `stories` table entries
- Enqueues stories for scoring

**3. Scoring Phase**
- Consumes stories from scoring queue
- LLM analyzes claims and gathers evidence
- Assigns verifiability labels: `verified`, `likely`, `contested`, `unverified`
- Calculates confidence scores (0-1)
- Updates story with summary, label, and confidence

**4. Serving Phase**
- API serves curated stories via REST endpoints
- Supports filtering, sorting, and pagination
- Frontend consumes API for user interface
- Real-time updates via polling or WebSocket

---

## Database Schema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           POSTGRESQL SCHEMA                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│     stories      │         │   story_items    │         │      items       │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ id (PK)          │◀────┬───│ story_id (FK)    │   ┌────▶│ id (PK)          │
│ title            │     │   │ item_id (FK)     │───┘     │ source_type      │
│ summary          │     │   └──────────────────┘         │ external_id      │
│ label            │     │                                │ url              │
│ confidence       │     │                                │ canonical_url    │
│ thumbnail_url    │     │         ┌──────────────────┐   │ title            │
│ first_seen_at    │     │         │     claims       │   │ content          │
│ updated_at       │◀────┼────┬────├──────────────────┤   │ author           │
│ created_at       │     │    │    │ id (PK)          │   │ score            │
└──────────────────┘     │    │    │ story_id (FK)    │   │ posted_at        │
                         │    │    │ text             │   │ raw_data         │
                         │    │    │ type             │   │ created_at       │
                         │    │    │ status           │   └──────────────────┘
                         │    │    │ created_at       │
                         │    │    └──────────────────┘
                         │    │
                         │    │         ┌──────────────────┐
                         │    │         │    evidence      │
                         │    │         ├──────────────────┤
                         │    └────────▶│ id (PK)          │
                         │              │ story_id (FK)    │
                         │              │ url              │
                         │              │ title            │
                         │              │ stance           │
                         │              │ snippet          │
                         │              │ created_at       │
                         │              └──────────────────┘
                         │
                         │              ┌──────────────────┐
                         │              │  story_events    │
                         │              ├──────────────────┤
                         └─────────────▶│ id (PK)          │
                                        │ story_id (FK)    │
                                        │ event_type       │
                                        │ data (JSONB)     │
                                        │ created_at       │
                                        └──────────────────┘

┌──────────────────┐
│     sources      │
├──────────────────┤
│ id (PK)          │
│ name             │
│ type             │
│ url              │
│ is_active        │
└──────────────────┘
```

### Table Descriptions

| Table | Purpose |
|-------|---------|
| `stories` | Core entity representing a news story with title, summary, label, and confidence |
| `items` | Individual content pieces from external sources (HN posts, Reddit threads) |
| `story_items` | Many-to-many junction linking stories to their source items |
| `claims` | Extracted claims from stories with verification status |
| `evidence` | Supporting/contradicting evidence for claims |
| `story_events` | Audit trail of story lifecycle events |
| `sources` | Configuration for external content sources |

### Key Indexes

- `idx_items_source_external_id` - Unique constraint for deduplication
- `idx_items_posted_at` - For time-based queries
- `idx_stories_label_confidence` - For filtering by verifiability
- `idx_stories_first_seen_at` - For sorting by recency

---

## API Architecture

### REST API Design

The API follows RESTful principles with these characteristics:

- **Base URL**: `/api/v1/`
- **Content-Type**: `application/json`
- **Authentication**: Bearer token for admin endpoints
- **Versioning**: URI-based (`/v1/`, `/v2/`)

### Endpoint Structure

```
/api/v1/
├── GET  /health              → Health check
├── GET  /stories             → List stories (public)
├── GET  /stories/:id         → Get story details (public)
├── POST /admin/stories       → Create story (admin)
├── PATCH /admin/stories/:id  → Update story (admin)
└── DELETE /admin/stories/:id → Delete story (admin)
```

### Response Format

```typescript
// Success response
{
  "data": T,
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "uuid"
  }
}

// Paginated response
{
  "data": T[],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [...]
  }
}
```

---

## Worker Architecture

### Queue-Based Processing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKER ARCHITECTURE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   Redis     │
                              │   Queues    │
                              └──────┬──────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   Ingestion   │          │   Clustering  │          │    Scoring    │
│    Worker     │          │    Worker     │          │    Worker     │
├───────────────┤          ├───────────────┤          ├───────────────┤
│               │          │               │          │               │
│ Scheduler     │          │ Job Consumer  │          │ Job Consumer  │
│   (Cron)      │          │               │          │               │
│      │        │          │ Embeddings    │          │ LLM Analysis  │
│      ▼        │          │ Similarity    │          │ Evidence      │
│ Fetch Sources │          │ Clustering    │          │ Scoring       │
│ Store Items   │          │ Update Story  │          │ Update Story  │
│ Enqueue Jobs  │          │ Enqueue Score │          │ Generate Thumb│
│               │          │               │          │               │
└───────────────┘          └───────────────┘          └───────────────┘

Retry Policy: 3 attempts with exponential backoff
Concurrency: Configurable per queue
Dead Letter: Failed jobs moved to DLQ after retries
```

### Queue Configuration

| Queue | Purpose | Concurrency | Retry |
|-------|---------|-------------|-------|
| `ingestion` | Fetch new content | 2 | 3x exponential |
| `clustering` | Group items into stories | 5 | 3x exponential |
| `scoring` | AI analysis and labeling | 3 | 3x exponential |
| `thumbnail` | Generate story thumbnails | 5 | 2x linear |

---

## Frontend Architecture

### Next.js App Router Structure

```
web/src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Home page (story feed)
│   ├── layout.tsx         # Root layout
│   ├── stories/
│   │   └── [id]/
│   │       └── page.tsx   # Story detail page
│   └── api/               # API routes (if needed)
│
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── story/            # Story-related components
│   ├── filters/          # Filter components
│   └── layout/           # Layout components
│
├── hooks/                # Custom React hooks
│   ├── useStories.ts     # Fetch stories
│   └── useStory.ts       # Fetch single story
│
├── store/                # Zustand state management
│   └── storyStore.ts     # Story filter/sort state
│
└── lib/                  # Utilities
    ├── api.ts            # API client
    └── utils.ts          # Helper functions
```

### State Management

- **Server State**: React Query (TanStack Query) for API data
- **Client State**: Zustand for UI state (filters, sorting)
- **Caching**: React Query cache with stale-while-revalidate

---

## Caching Strategy

### Multi-Layer Caching

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CACHING LAYERS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: CDN / Edge Cache                                      │
│  • Static assets (Next.js build output)                         │
│  • TTL: 1 hour for API responses                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: Redis Cache                                           │
│  • Story lists (filtered/sorted)                                │
│  • Individual story details                                     │
│  • TTL: 5 minutes for dynamic content                           │
│  • Cache keys: stories:{filter}:{sort}:{page}                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Application Cache                                     │
│  • React Query cache in browser                                 │
│  • Stale-while-revalidate pattern                               │
│  • Background refetching                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 4: Database                                              │
│  • PostgreSQL with query result caching                         │
│  • Connection pooling via PgBouncer (production)                │
└─────────────────────────────────────────────────────────────────┘
```

### Cache Invalidation

- **Story Updates**: Clear specific story cache + story list caches
- **New Stories**: Prepend to cached lists, trigger background refetch
- **Admin Changes**: Broadcast invalidation events via Redis pub/sub

---

## Security Considerations

### Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

Public Endpoints (No Auth)
├── GET /health
├── GET /stories
└── GET /stories/:id

Admin Endpoints (Token Required)
├── POST   /admin/*
├── PATCH  /admin/*
└── DELETE /admin/*

Header: Authorization: Bearer <ADMIN_TOKEN>
```

### Security Measures

| Layer | Implementation |
|-------|---------------|
| **Rate Limiting** | `@nestjs/throttler` - 100 req/min per IP |
| **CORS** | Configured origin whitelist |
| **Input Validation** | Zod schemas for all inputs |
| **SQL Injection** | Drizzle ORM parameterized queries |
| **XSS Protection** | Output encoding in frontend |
| **Secrets** | Environment variables only |
| **Container Security** | Non-root user in Docker |

### Data Privacy

- No user tracking or analytics without consent
- External source data retained per source ToS
- Claims and evidence sourced from public information

---

## Scalability Considerations

### Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      HORIZONTAL SCALING OPTIONS                              │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   Load      │
                    │  Balancer   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   API       │ │   API       │ │   API       │
    │ Instance 1  │ │ Instance 2  │ │ Instance N  │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────┴──────┐
                    │   Shared    │
                    │   Redis     │
                    └─────────────┘
```

### Database Scaling

- **Read Replicas**: For story listing queries
- **Connection Pooling**: PgBouncer in production
- **Partitioning**: Time-based partitioning for items/events tables
- **Archival**: Old data archived to cold storage

---

## Monitoring & Observability

### Logging

- **API**: Pino structured logging with request IDs
- **Worker**: Job-level logging with correlation IDs
- **Format**: JSON for production, pretty for development

### Metrics

| Metric | Source |
|--------|--------|
| Request rate/latency | API middleware |
| Queue depth/processing time | BullMQ metrics |
| DB query performance | Drizzle query logging |
| External API usage | Worker counters |

### Health Checks

- `/health` - Basic liveness check
- `/health/ready` - Readiness (DB + Redis connectivity)
- Docker health checks for all containers
