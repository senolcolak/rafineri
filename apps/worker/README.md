# Rafineri Worker

Background worker service for Rafineri news aggregation platform.

## Features

- **Ingestion Workers:**
  - HackerNews: Fetch top stories via official API
  - Reddit: Fetch from curated subreddits (skips gracefully if no credentials)

- **URL Canonicalization:**
  - Strips tracking parameters (utm_*, gclid, fbclid, ref, etc.)

- **Story Clustering:**
  - URL matching within 48h window
  - Title similarity using Jaccard index

- **Scoring Engine:**
  - Mock mode: Deterministic output from story title hash
  - Persists claims and evidence to database
  - Writes story events

- **Thumbnail Extraction:**
  - Extracts og:image from HTML with timeout
  - Fallback to placeholder

## Queues

| Queue | Purpose | Processor |
|-------|---------|-----------|
| `hn:ingest` | HackerNews ingestion | HNIngestProcessor |
| `reddit:ingest` | Reddit ingestion | RedditIngestProcessor |
| `story:cluster` | Cluster items into stories | StoryClusterProcessor |
| `story:score` | Score stories | StoryScoreProcessor |
| `story:thumbnail` | Extract thumbnails | StoryThumbnailProcessor |

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required Environment Variables

- `REDIS_HOST` - Redis server hostname
- `REDIS_PORT` - Redis server port
- `DATABASE_URL` - PostgreSQL connection string

### Optional Environment Variables

- `MOCK_MODE` - Enable mock scoring (default: true)
- `REDDIT_CLIENT_ID` - Reddit API client ID (leave empty to skip)
- `REDDIT_CLIENT_SECRET` - Reddit API client secret
- `CLUSTERING_SIMILARITY_THRESHOLD` - Jaccard threshold (default: 0.75)

## Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Docker

```bash
docker build -t rafineri-worker .
docker run -e REDIS_HOST=redis -e DATABASE_URL=... rafineri-worker
```

## Architecture

```
src/
├── config/           # Configuration modules
├── ingestion/        # HN & Reddit ingestion services
├── clustering/       # Story clustering & similarity utils
├── scoring/          # Scoring engine & mock scoring
├── thumbnail/        # Thumbnail extraction
├── queues/           # Queue definitions & processors
└── common/           # Shared utilities
```

## Queue Jobs

### Adding HN Ingest Job

```typescript
await hnQueue.add('ingest', {
  batchSize: 30,
});
```

### Adding Reddit Ingest Job

```typescript
await redditQueue.add('ingest', {
  subreddits: ['technology', 'science'],
  limit: 25,
});
```

### Adding Score Job

```typescript
await scoreQueue.add('score-story', {
  storyId: 'story-123',
  priority: 1,
});
```
