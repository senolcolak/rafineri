# Admin API Implementation Summary

> Complete REST API for the Rafineri Admin Panel

---

## ✅ Implemented Endpoints

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/dashboard` | Get dashboard statistics |

**Response:**
```json
{
  "totalStories": 1234,
  "storiesToday": 12,
  "pendingReview": 45,
  "totalSources": 3,
  "systemHealth": {
    "api": "healthy",
    "worker": "healthy",
    "database": "healthy"
  },
  "recentActivity": [
    {
      "id": "1",
      "type": "story_created",
      "message": "New story created",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

### Stories Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/stories` | List all stories (paginated) |
| `GET` | `/api/v1/admin/stories/:id` | Get single story details |
| `PATCH` | `/api/v1/admin/stories/:id` | Update story metadata |
| `DELETE` | `/api/v1/admin/stories/:id` | Delete story |
| `POST` | `/api/v1/admin/stories/:id/rescore` | Recalculate story scores |
| `POST` | `/api/v1/admin/stories/:id/refresh-thumbnail` | Refresh story thumbnail |

**List Stories Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `q` - Search query (searches title)
- `label` - Filter by label (verified, likely, contested, unverified)

**Update Story Body:**
```json
{
  "title": "New Title",
  "summary": "Updated summary",
  "category": "Technology",
  "label": "verified"
}
```

### Sources Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/sources` | List all sources |
| `PATCH` | `/api/v1/admin/sources/:id` | Enable/disable source |

**Update Source Body:**
```json
{
  "isActive": true,
  "config": { "limit": 50 }
}
```

### Thumbnails

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/admin/thumbnails/refresh-all` | Bulk refresh thumbnails |

**Request Body:**
```json
{
  "limit": 100,
  "force": false
}
```

### Health & Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/admin/health` | System health status |
| `GET` | `/api/v1/admin/logs` | Application logs |
| `GET` | `/api/v1/admin/metrics` | Prometheus metrics |

---

## 🔒 Authentication

All endpoints require Bearer token authentication:

```bash
Authorization: Bearer YOUR_ADMIN_TOKEN
```

The token is configured via `ADMIN_TOKEN` environment variable.

---

## 📁 Files Modified/Created

### API Layer

```
apps/api/src/admin/
├── admin.controller.ts      # Extended with CRUD endpoints
├── admin.service.ts         # Added business logic
└── admin.module.ts          # Added StoriesModule dependency
```

### Key Methods Added

**AdminService:**
- `getDashboardStats()` - Dashboard statistics
- `getStories()` - Paginated story listing
- `updateStory()` - Update story metadata
- `deleteStory()` - Delete story and relations
- `getSources()` - List all sources
- `updateSource()` - Enable/disable sources
- `getHealthStatus()` - System health check
- `getLogs()` - Application logs
- `getMetrics()` - Prometheus metrics

---

## 🔌 Admin Panel Integration

The admin panel frontend (`apps/web/src/lib/admin-api.ts`) connects to these endpoints:

```typescript
// All methods implemented and ready
adminApi.getStories({ page, limit, q, label })
adminApi.getStory(id)
adminApi.updateStory(id, data)
adminApi.deleteStory(id)
adminApi.getSources()
adminApi.updateSource(id, data)
adminApi.getHealth()
adminApi.getLogs(lines)
adminApi.getMetrics()
```

---

## 🧪 Testing the API

### Using curl

```bash
# Set admin token
ADMIN_TOKEN="dev-admin-token"

# Get dashboard
 curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:3001/api/v1/admin/dashboard

# List stories
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:3001/api/v1/admin/stories?page=1&limit=10"

# Update story
curl -X PATCH \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"label":"verified"}' \
     http://localhost:3001/api/v1/admin/stories/1

# Delete story
curl -X DELETE \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:3001/api/v1/admin/stories/1

# Get sources
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     http://localhost:3001/api/v1/admin/sources

# Toggle source
curl -X PATCH \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"isActive":false}' \
     http://localhost:3001/api/v1/admin/sources/1
```

### Using Swagger UI

Access the interactive API documentation at:
```
http://localhost:3001/docs
```

All admin endpoints are tagged with "Admin" and show the lock icon indicating they require authentication.

---

## 📊 Build Status

| Container | Status | Image |
|-----------|--------|-------|
| `rafineri-web:test` | ✅ Built | Complete with admin panel |
| `rafineri-api:test` | ✅ Built | Complete admin API |
| `rafineri-worker:test` | ✅ Built | Background processing |

---

## 🚀 Next Steps

1. **Run the stack:**
   ```bash
   docker-compose up -d
   ```

2. **Access the admin panel:**
   ```
   http://localhost:3000/admin
   ```

3. **Test the API:**
   ```
   http://localhost:3001/docs
   ```

4. **Future enhancements:**
   - Add user authentication (JWT/OAuth)
   - Implement audit logging
   - Add bulk operations
   - Create data export functionality
