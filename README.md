# Rafineri

> **Curated news intelligence for the discerning reader.**

Rafineri is an intelligent news aggregation and verification platform that automatically ingests content from sources like Hacker News and Reddit, clusters related stories using AI, assigns verifiability scores, and presents curated feeds through a modern web interface.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9+-orange.svg)](https://pnpm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Project Overview

Rafineri transforms scattered online discussions into organized, verifiable stories:

1. **Ingestion** - Automatically fetches trending content from Hacker News, Reddit, and other sources
2. **Clustering** - AI-powered grouping of related items into cohesive stories
3. **Scoring** - Multi-dimensional analysis assigning verifiability labels (verified, likely, contested, unverified)
4. **Serving** - Clean REST API and modern React frontend for browsing curated news

### Key Features

- 🤖 **AI-Powered Clustering** - Intelligent story grouping using embeddings and LLM analysis
- ✅ **Verifiability Scoring** - Four-tier labeling system with confidence scores
- 🔄 **Real-time Updates** - Background workers continuously ingest and process new content
- 📊 **Interactive Dashboard** - Next.js frontend with filtering, sorting, and search
- 🔒 **Admin Controls** - Secure API endpoints for story management
- 🐳 **Docker Ready** - Complete development and production Docker Compose setup

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Monorepo** | pnpm workspaces + Turborepo |
| **API** | NestJS 10 + TypeScript |
| **Frontend** | Next.js 14 + React 18 + Tailwind CSS |
| **Workers** | NestJS + BullMQ |
| **Database** | PostgreSQL 16 |
| **ORM** | Drizzle ORM |
| **Caching/Queues** | Redis 7 + BullMQ |
| **AI/ML** | OpenAI GPT / Anthropic Claude APIs |
| **Testing** | Jest + Supertest |
| **DevOps** | Docker + Docker Compose |

---

## 📋 Prerequisites

- **Node.js** 20.0.0 or higher ([download](https://nodejs.org/))
- **pnpm** 9.0.0 or higher ([install](https://pnpm.io/installation))
- **Docker** & **Docker Compose** (optional, for containerized development)

Verify your environment:

```bash
node --version    # Should be v20.0.0+
pnpm --version    # Should be 9.0.0+
docker --version  # Should be 24.0.0+
```

---

## 🚀 Quick Start

> **Note:** First time setup requires installing dependencies. If you encounter lockfile errors, run `pnpm install` locally first to generate `pnpm-lock.yaml`, or use the development compose below.

### Using Docker (Recommended for Quick Start)

```bash
# Copy environment file and start all services
cp .env.example .env
docker compose up --build

# The build may take a few minutes on first run.
# Services will be available at:
# - Web: http://localhost:3000
# - API: http://localhost:3001
```

### Local Development (without Docker)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rafineri
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start infrastructure services** (PostgreSQL & Redis)
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

6. **Start development servers**
   ```bash
   # Terminal 1: Start API
   pnpm --filter api dev

   # Terminal 2: Start Worker
   pnpm --filter worker dev

   # Terminal 3: Start Web
   pnpm --filter web dev
   ```

7. **Access the applications**
   - Web: http://localhost:3000
   - API: http://localhost:3001
   - API Docs: http://localhost:3001/docs

### Docker Compose Development

The easiest way to run the entire stack:

```bash
# Start all services
docker-compose up

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- API on port 3001
- Web frontend on port 3000
- Background worker

---

## 🚀 Server Deployment (Simple)

For deploying on a single Linux VM with Docker Compose:

```bash
# 1. Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# 2. Clone and configure
git clone <repository-url>
cd rafineri
cp .env.server.example .env
# Edit .env with your production settings

# 3. Deploy
docker compose -f docker-compose.server.yml up -d --build

# 4. Monitor
docker compose -f docker-compose.server.yml logs -f
```

**Access points:**
- Web UI: `http://your-server-ip:3000`
- API: `http://your-server-ip:3001`

For detailed deployment instructions including SSL, monitoring, and backups, see:
- [Server Deployment Guide](./docs/Server-Deployment.md)
- [Production Compose File](./docker-compose.server.yml)

---

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `MOCK_MODE` | Use mock AI responses (no API keys needed) | `true` |
| `ADMIN_TOKEN` | Bearer token for admin endpoints | `dev-admin-token` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://rafineri:rafineri@localhost:5432/rafineri` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `REDDIT_CLIENT_ID` | Reddit API client ID | - |
| `REDDIT_CLIENT_SECRET` | Reddit API client secret | - |
| `REDDIT_USER_AGENT` | Reddit API user agent | `Rafineri/1.0` |
| `OPENAI_API_KEY` | OpenAI API key for clustering/scoring | - |
| `ANTHROPIC_API_KEY` | Anthropic API key (alternative to OpenAI) | - |
| `NEXT_PUBLIC_API_URL` | API URL for frontend | `http://localhost:3001` |

**Development with Mock Mode:**
Set `MOCK_MODE=true` to run without AI API keys. The system will generate realistic mock responses for clustering and scoring operations.

---

## 🧪 Testing

```bash
# Run all tests across the monorepo
pnpm test

# Run tests for specific app
pnpm --filter api test
pnpm --filter worker test

# Run tests in watch mode
pnpm --filter api test:watch

# Run e2e tests
pnpm --filter api test:e2e

# Generate coverage report
pnpm --filter api test:cov
```

---

## 📁 Project Structure

```
rafineri/
├── apps/
│   ├── api/                    # NestJS REST API
│   │   ├── src/
│   │   │   ├── admin/          # Admin endpoints
│   │   │   ├── common/         # Guards, filters, interceptors, pipes
│   │   │   ├── config/         # Configuration modules
│   │   │   ├── database/       # Drizzle schema and migrations
│   │   │   ├── health/         # Health check endpoint
│   │   │   └── stories/        # Story CRUD endpoints
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── worker/                 # Background job processor
│   │   ├── src/
│   │   │   ├── clustering/     # Story clustering logic
│   │   │   ├── common/         # Shared utilities
│   │   │   ├── config/         # Configuration
│   │   │   ├── ingestion/      # Content ingestion from sources
│   │   │   ├── queues/         # BullMQ queue definitions
│   │   │   ├── scoring/        # AI scoring and labeling
│   │   │   └── thumbnail/      # Thumbnail generation
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/            # Next.js App Router
│       │   ├── components/     # React components
│       │   ├── hooks/          # Custom React hooks
│       │   ├── lib/            # Utilities
│       │   ├── store/          # Zustand state management
│       │   └── types/          # TypeScript types
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared types and schemas
│       ├── src/
│       │   ├── types/          # Core TypeScript interfaces
│       │   ├── schemas/        # Zod validation schemas
│       │   └── enums/          # Shared enums
│       └── package.json
│
├── docs/                       # Documentation
│   ├── Architecture.md
│   ├── API.md
│   └── adr/                    # Architecture Decision Records
│
├── docker-compose.yml          # Development stack
├── turbo.json                  # Turborepo configuration
├── pnpm-workspace.yaml         # pnpm workspace config
└── package.json                # Root package.json
```

---

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Run linting across the monorepo |
| `pnpm test` | Run all tests |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:studio` | Open Drizzle Studio (DB GUI) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🆘 Support

- 📧 Email: support@rafineri.io
- 🐛 Issues: [GitHub Issues](https://github.com/rafineri-org/rafineri/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/rafineri-org/rafineri/discussions)

---

<p align="center">Built with ❤️ by the Rafineri Team</p>
# rafineri
