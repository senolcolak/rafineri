# ADR 003: Drizzle ORM for Database Access

## Status

✅ **Accepted**

## Context

We need an ORM (Object-Relational Mapping) tool for PostgreSQL database access across:
- **API Service** - Querying stories, items, and related data
- **Worker Service** - Inserting and updating processed data
- **Shared Package** - Type definitions that match database schema

Key requirements:
- TypeScript-first with excellent type inference
- SQL-like query syntax
- Migration support
- Good performance
- Easy to understand for SQL-proficient developers
- Works well with our monorepo setup

## Decision

We will use **Drizzle ORM** as our database access layer.

### Schema Definition

```typescript
// packages/shared/src/schemas/stories.ts
import { pgTable, uuid, varchar, text, timestamp, real } from 'drizzle-orm/pg-core';

export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 500 }).notNull(),
  summary: text('summary'),
  label: varchar('label', { length: 20 }).notNull().default('unverified'),
  confidence: real('confidence').notNull().default(0),
  thumbnailUrl: text('thumbnail_url'),
  firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
```

### Query Example

```typescript
// Repository pattern with Drizzle
async findAll(options: ListStoriesOptions) {
  const { limit = 20, offset = 0, sort = 'hot', label } = options;

  const query = this.db.query.stories.findMany({
    where: label ? eq(stories.label, label) : undefined,
    orderBy: this.getOrderBy(sort),
    limit,
    offset,
  });

  return query;
}
```

### Migration

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (GUI)
pnpm db:studio
```

## Alternatives Considered

### Alternative 1: Prisma

**Pros:**
- Mature ecosystem with large community
- Excellent TypeScript support
- Auto-generated, type-safe client
- Great IDE support with extension
- Built-in connection pooling
- Mature migration system

**Cons:**
- Schema DSL (not TypeScript)
- Binary engine requires compilation
- Query engine adds deployment complexity
- Less control over generated SQL
- Lock-in to Prisma's query patterns
- Can be slow for complex queries

**Verdict:** Rejected - While excellent, the binary engine and DSL schema were concerns. Drizzle offers more transparency and SQL control.

### Alternative 2: TypeORM

**Pros:**
- Decorator-based (similar to our NestJS choice)
- Mature and feature-complete
- ActiveRecord and DataMapper patterns
- Good community support

**Cons:**
- Complex and heavy
- Slower than alternatives
- Inconsistent API
- Issues with eager loading
- Less type-safe than Prisma/Drizzle

**Verdict:** Rejected - Too complex and has reputation for issues in production.

### Alternative 3: Knex.js (Query Builder)

**Pros:**
- Flexible SQL builder
- No magic, just SQL
- Mature and stable
- Good migration support

**Cons:**
- Not a full ORM (no relations)
- Manual type definitions needed
- More boilerplate for common operations
- No automatic relation handling

**Verdict:** Rejected - Too low-level. We want relation handling and type inference.

### Alternative 4: Kysely

**Pros:**
- TypeScript-first query builder
- Excellent type inference
- SQL-like syntax
- Lightweight

**Cons:**
- Newer, smaller ecosystem
- No schema definition/migrations built-in
- More manual work for schema management

**Verdict:** Rejected - While excellent, Drizzle offers more complete solution with migrations.

### Alternative 5: Raw SQL (pg driver)

**Pros:**
- Maximum performance
- Full SQL control
- No abstraction overhead

**Cons:**
- No type safety
- Manual query building
- No migration system
- Maintenance burden

**Verdict:** Rejected - Too low-level for our productivity needs.

## Consequences

### Positive

1. **TypeScript-native** - Schema and queries are pure TypeScript
2. **SQL-like syntax** - Easy to understand for SQL-proficient developers
3. **Zero-runtime overhead** - No heavy query engine, just SQL generation
4. **Type inference** - `typeof table.$inferSelect` gives query result types
5. **Lightweight** - Small bundle size, no binary dependencies
6. **SQL control** - Can drop to raw SQL when needed
7. **Drizzle Kit** - Good migration tooling and GUI studio
8. **Relations** - Handles joins and relations well
9. **Multiple drivers** - Works with postgres.js, node-postgres, neon, etc.
10. **Growing fast** - Active development, improving rapidly

### Negative

1. **Newer ecosystem** - Smaller community than Prisma/TypeORM
2. **Fewer resources** - Less Stack Overflow content, tutorials
3. **Rapid changes** - API might change between versions
4. **Some features missing** - No built-in soft deletes, complex caching
5. **DI integration** - Less documentation for NestJS integration

### Mitigations

- Pin versions to avoid breaking changes
- Document common patterns internally
- Contribute to ecosystem where possible
- Use Zod for additional runtime validation

## Implementation Details

### Database Configuration

```typescript
// apps/api/src/config/database.module.ts
import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@rafineri/shared/schemas';

@Module({
  providers: [
    {
      provide: 'DATABASE',
      useFactory: () => {
        const client = postgres(process.env.DATABASE_URL);
        return drizzle(client, { schema });
      },
    },
  ],
  exports: ['DATABASE'],
})
export class DatabaseModule {}
```

### Repository Pattern

```typescript
@Injectable()
export class StoriesRepository {
  constructor(@Inject('DATABASE') private db: Database) {}

  async findById(id: string): Promise<Story | undefined> {
    return this.db.query.stories.findFirst({
      where: eq(stories.id, id),
      with: {
        items: true,
        claims: true,
        evidence: true,
      },
    });
  }

  async create(data: NewStory): Promise<Story> {
    const [result] = await this.db.insert(stories).values(data).returning();
    return result;
  }
}
```

### Migration Workflow

1. **Modify schema** in `packages/shared/src/schemas/`
2. **Generate migration**: `pnpm db:generate`
3. **Review migration** in `apps/api/drizzle/`
4. **Apply migration**: `pnpm db:migrate`
5. **Update types** - Shared package types auto-infer from schema

## Comparison Summary

| Feature | Drizzle | Prisma | TypeORM | Knex |
|---------|---------|--------|---------|------|
| TypeScript-first | ✅ | Partial | ✅ | ❌ |
| SQL-like syntax | ✅ | ❌ | Partial | ✅ |
| Type inference | ✅ | ✅ | Partial | ❌ |
| Bundle size | Small | Large | Large | Small |
| Binary deps | No | Yes | No | No |
| Migrations | ✅ | ✅ | ✅ | Via ext |
| Community size | Growing | Large | Large | Medium |
| Performance | Fast | Medium | Slow | Fast |

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle vs Prisma](https://orm.drizzle.team/docs/comparisons/prisma)
- [PostgreSQL with Drizzle](https://orm.drizzle.team/docs/get-started-postgresql)

---

**Date:** 2024-01  
**Author:** Rafineri Team  
**Reviewers:** Engineering Team
