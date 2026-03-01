# Rafineri API

A NestJS REST API for the Rafineri platform with PostgreSQL, Drizzle ORM, and Redis caching.

## Features

- **REST API** with NestJS framework
- **Database** with PostgreSQL and Drizzle ORM
- **Caching** with Redis (configurable TTL 60-180s for trending)
- **Rate Limiting** with @nestjs/throttler
- **API Documentation** with Swagger at `/docs`
- **Structured Logging** with Pino
- **Input Validation** with Zod
- **Docker** support for containerization

## API Endpoints

### Health
- `GET /health` - Health check endpoint

### Stories
- `GET /v1/trending?sort=hot|most_verified|most_contested|newest&category=&label=&q=` - Get trending stories
- `GET /v1/categories` - Get all categories
- `GET /v1/stories/:id` - Get story details
- `GET /v1/stories/:id/claims` - Get story claims
- `GET /v1/stories/:id/evidence` - Get story evidence
- `GET /v1/stories/:id/events` - Get story events timeline

### Admin (requires x-admin-token header)
- `POST /v1/admin/stories/:id/rescore` - Recalculate story scores

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your configuration
```

### Database Setup

```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Open Drizzle Studio
npm run db:studio
```

### Running the App

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### Docker

```bash
# Build image
docker build -t rafineri-api .

# Run container
docker run -p 3000:3000 --env-file .env rafineri-api
```

## Configuration

See `.env.example` for all available configuration options.

### Key Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API port | 3000 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `ADMIN_TOKEN` | Admin API token | dev-admin-token |

## API Documentation

Once running, Swagger documentation is available at:
```
http://localhost:3000/docs
```

## Architecture

```
src/
├── config/           # Configuration files
├── common/           # Shared utilities (filters, guards, interceptors, pipes)
├── database/         # Database connection, schema, Redis
├── health/           # Health check endpoint
├── stories/          # Stories module (trending, categories, details)
├── admin/            # Admin module (rescore endpoint)
├── app.module.ts     # Root module
└── main.ts           # Application entry point
```

## License

MIT
