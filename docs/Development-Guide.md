# Rafineri Development Guide

> Guide for developers contributing to Rafineri

---

## Table of Contents

1. [Development Environment](#development-environment)
2. [Project Architecture](#project-architecture)
3. [Coding Standards](#coding-standards)
4. [Working with the API](#working-with-the-api)
5. [Working with the Frontend](#working-with-the-frontend)
6. [Database Operations](#database-operations)
7. [Testing](#testing)
8. [Debugging](#debugging)

---

## Development Environment

### Prerequisites

- Node.js 20+ with corepack enabled
- pnpm 9+
- Docker and Docker Compose
- Git

### Setup

```bash
# Clone repository
git clone <repository-url>
cd rafineri

# Enable pnpm
corepack enable
corepack prepare pnpm@9.0.0 --activate

# Install dependencies
pnpm install

# Copy environment
cp .env.example .env

# Start infrastructure
docker-compose up -d postgres redis

# Run migrations
pnpm db:migrate

# Start development
pnpm dev
```

---

## Project Architecture

### Monorepo Structure

```
rafineri/
├── apps/
│   ├── api/           # NestJS REST API
│   ├── worker/        # Background job processor
│   └── web/           # Next.js frontend
├── packages/
│   └── shared/        # Shared types and utilities
└── docs/              # Documentation
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sources   │────▶│   Worker    │────▶│  Database   │
│  (HN/Reddit)│     │ (Ingestion) │     │(PostgreSQL) │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                       ┌────────────────────────┘
                       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     Web     │◀────│     API     │◀────│    Redis    │
│  (Next.js)  │     │  (NestJS)   │     │   (Cache)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## Coding Standards

### TypeScript

- Use strict mode
- Explicit return types on public functions
- Interface over type for object shapes
- No `any` types

```typescript
// Good
interface Story {
  id: string;
  title: string;
}

function getStory(id: string): Promise<Story | null> {
  // ...
}

// Bad
function getStory(id: any): any {
  // ...
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `storyCount` |
| Constants | UPPER_SNAKE | `MAX_RETRY` |
| Functions | camelCase | `fetchStories` |
| Classes | PascalCase | `StoryService` |
| Interfaces | PascalCase | `Story` |
| Enums | PascalCase | `StoryStatus` |
| Files | kebab-case | `story-service.ts` |

### NestJS (API/Worker)

```typescript
// Controller
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  async findAll(): Promise<Story[]> {
    return this.storiesService.findAll();
  }
}

// Service
@Injectable()
export class StoriesService {
  constructor(@Inject(DATABASE) private db: Database) {}

  async findAll(): Promise<Story[]> {
    return this.db.query.stories.findMany();
  }
}
```

### React (Frontend)

```typescript
// Component with TypeScript
interface StoryCardProps {
  story: Story;
  onClick?: (id: string) => void;
}

export function StoryCard({ story, onClick }: StoryCardProps) {
  return (
    <div onClick={() => onClick?.(story.id)}>
      {story.title}
    </div>
  );
}
```

---

## Working with the API

### Adding a New Endpoint

1. **Create DTO** (if needed):
```typescript
// src/stories/dto/create-story.dto.ts
export class CreateStoryDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;
}
```

2. **Add to Controller**:
```typescript
@Post()
@UsePipes(new ZodValidationPipe(CreateStorySchema))
async create(@Body() dto: CreateStoryDto) {
  return this.storiesService.create(dto);
}
```

3. **Implement in Service**:
```typescript
async create(dto: CreateStoryDto): Promise<Story> {
  const [story] = await this.db.insert(stories).values(dto).returning();
  return story;
}
```

4. **Add Tests**:
```typescript
describe('StoriesController', () => {
  it('should create a story', async () => {
    const dto = { title: 'Test' };
    const result = await controller.create(dto);
    expect(result.title).toBe('Test');
  });
});
```

---

## Working with the Frontend

### Adding a New Page

1. **Create page component**:
```typescript
// src/app/new-page/page.tsx
'use client';

export default function NewPage() {
  return <div>New Page Content</div>;
}
```

2. **Add to navigation** (if needed):
```typescript
// src/components/layout/sidebar.tsx
const navItems = [
  { href: '/', label: 'Feed' },
  { href: '/new-page', label: 'New Page' },
];
```

### State Management

Use Zustand for global state:

```typescript
// src/store/new-store.ts
import { create } from 'zustand';

interface NewState {
  count: number;
  increment: () => void;
}

export const useNewStore = create<NewState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### API Integration

```typescript
// src/hooks/use-new-data.ts
import { useQuery } from '@tanstack/react-query';

export function useNewData() {
  return useQuery({
    queryKey: ['new-data'],
    queryFn: async () => {
      const response = await api.get('/new-endpoint');
      return response;
    },
  });
}
```

---

## Database Operations

### Schema Changes

1. **Update schema**:
```typescript
// src/database/schema.ts
export const stories = pgTable('stories', {
  // ... existing fields
  newField: varchar('new_field', { length: 100 }),
});
```

2. **Generate migration**:
```bash
pnpm db:generate
```

3. **Apply migration**:
```bash
pnpm db:migrate
```

### Query Patterns

```typescript
// Select with relations
const storiesWithItems = await db.query.stories.findMany({
  with: {
    storyItems: {
      with: {
        item: true,
      },
    },
  },
});

// Insert
const [newStory] = await db.insert(stories).values({
  title: 'New Story',
}).returning();

// Update
await db.update(stories)
  .set({ label: 'verified' })
  .where(eq(stories.id, storyId));

// Delete
await db.delete(stories).where(eq(stories.id, storyId));
```

---

## Testing

### Unit Tests

```typescript
// story.service.spec.ts
describe('StoryService', () => {
  let service: StoryService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [StoryService],
    }).compile();

    service = module.get<StoryService>(StoryService);
  });

  it('should find story by id', async () => {
    const story = await service.findOne('123');
    expect(story).toBeDefined();
  });
});
```

### E2E Tests

```typescript
// stories.e2e-spec.ts
describe('StoriesController (e2e)', () => {
  it('/stories (GET)', () => {
    return request(app.getHttpServer())
      .get('/stories')
      .expect(200)
      .expect((res) => {
        expect(res.body).toBeInstanceOf(Array);
      });
  });
});
```

### Running Tests

```bash
# All tests
pnpm test

# Specific app
pnpm --filter api test

# Watch mode
pnpm --filter api test:watch

# Coverage
pnpm --filter api test:cov
```

---

## Debugging

### API Debugging

```typescript
// Add breakpoints or logs
@Get(':id')
async findOne(@Param('id') id: string) {
  console.log('Finding story:', id); // Debug log
  debugger; // Breakpoint
  return this.service.findOne(id);
}
```

### Worker Debugging

```bash
# Enable debug logging
DEBUG_WORKER=true pnpm --filter worker dev

# Or in .env
LOG_LEVEL=debug
```

### Frontend Debugging

```typescript
// React DevTools
// Enable in next.config.js
module.exports = {
  reactStrictMode: true,
  // DevTools enabled by default in dev
};

// Console debugging
useEffect(() => {
  console.log('Stories updated:', stories);
}, [stories]);
```

### Database Debugging

```bash
# Open Drizzle Studio
pnpm db:studio

# Or use psql
docker exec -it rafineri-postgres psql -U rafineri

# Check slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

---

## Useful Commands

```bash
# Development
pnpm dev              # Start all apps
pnpm dev:api          # Start API only
pnpm dev:worker       # Start Worker only
pnpm dev:web          # Start Web only

# Building
pnpm build            # Build all apps
pnpm build:api        # Build API only

# Database
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio

# Testing
pnpm test             # Run all tests
pnpm test:e2e         # Run E2E tests
pnpm test:cov         # Generate coverage

# Linting
pnpm lint             # Lint all apps
pnpm lint:fix         # Fix lint errors

# Type checking
pnpm typecheck        # Check TypeScript types
```

---

## Resources

- [NestJS Docs](https://docs.nestjs.com/)
- [Next.js Docs](https://nextjs.org/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TanStack Query Docs](https://tanstack.com/query/latest)
