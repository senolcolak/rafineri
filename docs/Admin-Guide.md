# Rafineri Administration Guide

> Complete guide for administering the Rafineri platform

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Story Management](#story-management)
4. [Source Management](#source-management)
5. [System Configuration](#system-configuration)
6. [Monitoring & Logs](#monitoring--logs)
7. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Accessing the Admin Panel

The admin panel is available at `/admin` route in the web application.

**Default Access:**
- URL: `http://localhost:3000/admin` (development)
- Authentication: Bearer token via `ADMIN_TOKEN` environment variable

### Authentication

The admin API endpoints require authentication using the `ADMIN_TOKEN`:

```bash
# Example API call with admin token
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3001/api/v1/admin/stories
```

---

## Dashboard Overview

The admin dashboard provides a comprehensive view of system health and activity:

### Key Metrics

| Metric | Description |
|--------|-------------|
| **Total Stories** | Number of stories in the database |
| **Stories Today** | Stories created in the last 24 hours |
| **Pending Review** | Stories awaiting manual review |
| **System Health** | API, Worker, and Database status |
| **Queue Status** | Background job queue statistics |

### Real-time Statistics

- **Ingestion Rate**: Items processed per hour
- **Clustering Performance**: Average clustering time
- **API Response Times**: p50, p95, p99 latencies

---

## Story Management

### Viewing Stories

The Stories page allows you to:
- Browse all stories with filtering and sorting
- View story details including claims and evidence
- Edit story metadata
- Delete stories

### Story Actions

#### Edit Story

1. Navigate to **Stories** → Select a story
2. Click **Edit** button
3. Modify fields:
   - **Title**: Story headline
   - **Summary**: AI-generated or manual summary
   - **Label**: Verifiability classification
   - **Category**: News category
   - **Thumbnail**: Custom image URL
4. Click **Save Changes**

#### Change Verifiability Label

1. Open story detail page
2. Click **Change Label** dropdown
3. Select new label:
   - ✅ **Verified**: Multiple credible sources confirm
   - 🔵 **Likely**: Evidence supports, more verification needed
   - 🟡 **Contested**: Conflicting evidence exists
   - ⚪ **Unverified**: Insufficient evidence

#### Delete Story

> ⚠️ **Warning**: Deletion is permanent and cannot be undone.

1. Select story → Click **Delete**
2. Confirm deletion in the modal
3. Story will be removed from all feeds

### Bulk Operations

Select multiple stories to perform bulk actions:
- **Bulk Label Change**: Update labels for multiple stories
- **Bulk Delete**: Remove multiple stories
- **Export**: Export story data to JSON/CSV

---

## Source Management

### Managing Content Sources

Rafineri ingests content from configured sources. The Sources page allows you to manage these.

### Source Types

| Type | Description | Configuration |
|------|-------------|---------------|
| **Hacker News** | Top stories from HN | No auth required |
| **Reddit** | Subreddit posts | Requires Reddit API credentials |
| **Manual** | Manually added items | Admin-only |

### Adding a Reddit Source

1. Navigate to **Sources** → **Add Source**
2. Select **Reddit** as type
3. Configure:
   - **Subreddit**: e.g., `technology`, `science`
   - **Post Limit**: Max posts to fetch (default: 25)
   - **Active**: Enable/disable ingestion
4. Save configuration

### Source Actions

- **Enable/Disable**: Toggle source activity
- **Edit Configuration**: Update source settings
- **Trigger Ingestion**: Manually start ingestion
- **View History**: See recent ingestion runs

---

## System Configuration

### Environment Variables

Key configuration options accessible via environment:

```bash
# Core Settings
NODE_ENV=production
MOCK_MODE=false
ADMIN_TOKEN=your-secure-admin-token

# Ingestion Settings
HN_CONCURRENCY=5
HN_BATCH_SIZE=30
REDDIT_LIMIT=25

# Clustering Settings
CLUSTERING_SIMILARITY_THRESHOLD=0.75
CLUSTERING_TIME_WINDOW_HOURS=48

# Thumbnail Settings
THUMBNAIL_TIMEOUT=5000
THUMBNAIL_REFRESH_INTERVAL_HOURS=24
```

### Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| `ENABLE_HN_INGESTION` | Enable Hacker News ingestion | `true` |
| `ENABLE_REDDIT_INGESTION` | Enable Reddit ingestion | `true` |
| `ENABLE_AUTO_CLUSTERING` | Auto-cluster new items | `true` |
| `ENABLE_THUMBNAIL_REFRESH` | Auto-refresh thumbnails | `true` |

---

## Monitoring & Logs

### Health Checks

Monitor system health via the Health page:

- **API Status**: HTTP response time and error rate
- **Worker Status**: Queue processing status
- **Database Status**: Connection pool and query performance
- **Redis Status**: Cache and queue connectivity

### Viewing Logs

Access logs via the Logs page or API:

```bash
# Get recent logs
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:3001/api/v1/admin/logs?lines=100

# Stream logs (SSE)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:3001/api/v1/admin/logs/stream
```

### Metrics

Prometheus-compatible metrics available at `/metrics`:

- `rafineri_stories_total`: Total stories count
- `rafineri_items_ingested_total`: Items ingested counter
- `rafineri_clustering_duration_seconds`: Clustering latency
- `rafineri_api_requests_total`: API request counter

---

## Troubleshooting

### Common Issues

#### Stories Not Appearing

**Symptoms**: No new stories in feed

**Checklist**:
1. Verify worker is running: `docker ps | grep worker`
2. Check queue status in admin panel
3. Review worker logs for errors
4. Verify database connection

#### Clustering Not Working

**Symptoms**: Items not being grouped into stories

**Solutions**:
1. Check if `MOCK_MODE=true` (uses mock clustering)
2. Verify OpenAI/Anthropic API keys
3. Check clustering queue in BullMQ dashboard
4. Review worker logs for API errors

#### High Memory Usage

**Solutions**:
1. Reduce `HN_BATCH_SIZE` and `REDDIT_LIMIT`
2. Lower `CLUSTERING_TIME_WINDOW_HOURS`
3. Enable request throttling
4. Scale horizontally with multiple worker instances

### Debug Mode

Enable debug logging:

```bash
# In .env
LOG_LEVEL=debug

# Or for specific components
DEBUG_WORKER=true
DEBUG_CLUSTERING=true
```

### Database Maintenance

```bash
# Analyze tables for query optimization
pnpm db:studio

# Check for orphaned records
SELECT * FROM items WHERE id NOT IN (SELECT item_id FROM story_items);

# Clean up old events (keep 30 days)
DELETE FROM story_events WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## API Reference

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/dashboard` | GET | Dashboard statistics |
| `/api/v1/admin/stories` | GET | List all stories |
| `/api/v1/admin/stories/:id` | PATCH | Update story |
| `/api/v1/admin/stories/:id` | DELETE | Delete story |
| `/api/v1/admin/sources` | GET/POST | List/Create sources |
| `/api/v1/admin/sources/:id` | PATCH/DELETE | Update/Delete source |
| `/api/v1/admin/health` | GET | System health status |
| `/api/v1/admin/logs` | GET | System logs |
| `/api/v1/admin/metrics` | GET | Prometheus metrics |

See [API.md](./API.md) for detailed endpoint documentation.

---

## Best Practices

### Security

- Rotate `ADMIN_TOKEN` regularly
- Use HTTPS in production
- Enable rate limiting
- Monitor access logs for suspicious activity

### Performance

- Regular database maintenance (VACUUM, ANALYZE)
- Monitor queue depths
- Scale workers based on load
- Use Redis for caching

### Data Quality

- Regularly review contested stories
- Update verifiability labels as new evidence emerges
- Monitor source quality and disable low-quality sources
- Keep AI model prompts updated

---

## Support

For admin-related issues:
- 📧 Email: admin-support@rafineri.io
- 🐛 GitHub Issues: Tag with `admin` label
- 📖 Documentation: [docs.rafineri.io](https://docs.rafineri.io)
