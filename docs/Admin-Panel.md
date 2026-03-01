# Rafineri Admin Panel

> Complete administration interface for managing the Rafineri platform

---

## Overview

The Rafineri Admin Panel provides a comprehensive web interface for system administration, content moderation, and configuration management.

**Access URL:** `/admin`

---

## Features

### 📊 Dashboard
- Real-time system health monitoring
- Key metrics (total stories, stories today, pending review)
- Recent activity feed
- System status indicators

### 📰 Story Management
- Browse all stories with search and pagination
- Edit story details (title, summary, category, label)
- Change verifiability labels
- Delete stories with confirmation
- Bulk operations support

### 📡 Source Management
- View all content sources
- Enable/disable ingestion sources
- Trigger manual ingestion
- Monitor ingestion statistics

### ⚙️ System Settings
- Ingestion configuration (HN/Reddit)
- Clustering parameters
- Feature flags
- Admin token management

### 📈 Analytics (Placeholder)
- Traffic overview
- User engagement metrics
- Performance statistics

### 👥 User Management (Placeholder)
- Admin user management
- Permission controls

---

## File Structure

```
apps/web/src/app/admin/
├── layout.tsx           # Admin layout with sidebar navigation
├── page.tsx             # Dashboard overview
├── stories/
│   ├── page.tsx         # Stories list with CRUD
│   └── [id]/
│       └── edit/
│           └── page.tsx # Story edit form
├── sources/
│   └── page.tsx         # Source management
├── settings/
│   └── page.tsx         # System configuration
├── analytics/
│   └── page.tsx         # Analytics dashboard
└── users/
    └── page.tsx         # User management
```

---

## Components

### UI Components (apps/web/src/components/ui/)

| Component | Description |
|-----------|-------------|
| `badge.tsx` | Status badges for labels |
| `button.tsx` | Action buttons |
| `card.tsx` | Content containers |
| `dropdown-menu.tsx` | Action menus |
| `input.tsx` | Form inputs |
| `label.tsx` | Form labels |
| `select.tsx` | Dropdown selects |
| `switch.tsx` | Toggle switches |
| `textarea.tsx` | Multi-line inputs |

### Admin API Client (apps/web/src/lib/admin-api.ts)

Provides typed API methods for admin operations:

```typescript
// Stories
adminApi.getStories(params)
adminApi.getStory(id)
adminApi.updateStory(id, data)
adminApi.deleteStory(id)

// Sources
adminApi.getSources()
adminApi.updateSource(id, data)

// System
adminApi.getHealth()
adminApi.getLogs(lines)
adminApi.getMetrics()
```

---

## Authentication

The admin panel uses Bearer token authentication. Set the token via environment variable:

```bash
# .env
NEXT_PUBLIC_ADMIN_TOKEN=your-admin-token
```

---

## Routes

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard overview |
| `/admin/stories` | Story management list |
| `/admin/stories/[id]/edit` | Edit specific story |
| `/admin/sources` | Source management |
| `/admin/settings` | System configuration |
| `/admin/analytics` | Analytics dashboard |
| `/admin/users` | User management |

---

## API Integration

The admin panel integrates with the following API endpoints:

```
GET    /api/v1/admin/dashboard
GET    /api/v1/admin/stories
GET    /api/v1/admin/stories/:id
PATCH  /api/v1/admin/stories/:id
DELETE /api/v1/admin/stories/:id
GET    /api/v1/admin/sources
PATCH  /api/v1/admin/sources/:id
GET    /api/v1/admin/health
GET    /api/v1/admin/logs
GET    /api/v1/admin/metrics
```

---

## Building for Production

```bash
# Build web container with admin panel
docker build -f Dockerfile.web -t rafineri-web .

# Or build all containers
docker-compose build
```

---

## Future Enhancements

- [ ] Real-time updates via WebSocket
- [ ] Bulk import/export functionality
- [ ] Advanced filtering and search
- [ ] Role-based access control (RBAC)
- [ ] Audit logging
- [ ] Performance charts
- [ ] Queue monitoring dashboard
- [ ] A/B testing configuration
