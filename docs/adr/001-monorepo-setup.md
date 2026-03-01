# ADR 001: Monorepo Setup with pnpm + Turborepo

## Status

✅ **Accepted**

## Context

Rafineri is composed of multiple distinct applications that share common code:

- **API** (NestJS) - REST API serving story data
- **Worker** (NestJS) - Background job processing for ingestion, clustering, and scoring
- **Web** (Next.js) - Frontend application
- **Shared** - Common types, schemas, and utilities

We needed to decide on a repository structure that would:
1. Allow code sharing between applications
2. Maintain clear separation of concerns
3. Provide efficient build and development workflows
4. Support independent deployment of services
5. Be maintainable by a small team

## Decision

We will use **pnpm workspaces** combined with **Turborepo** for our monorepo setup.

### Structure

```
rafineri/
├── apps/
│   ├── api/              # NestJS API
│   ├── worker/           # Background worker
│   └── web/              # Next.js frontend
├── packages/
│   └── shared/           # Shared code
├── pnpm-workspace.yaml   # Workspace definition
└── turbo.json            # Turborepo pipeline config
```

### Key Configuration

**pnpm-workspace.yaml**:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**turbo.json**:
```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Alternatives Considered

### Alternative 1: Separate Repositories

**Pros:**
- Complete isolation between services
- Independent versioning
- Teams can work autonomously

**Cons:**
- Code duplication for shared types/schemas
- Complex versioning and synchronization
- More difficult to make cross-cutting changes
- Multiple PRs for single features

**Verdict:** Rejected - too much overhead for our team size and shared domain model.

### Alternative 2: npm/yarn workspaces

**Pros:**
- Native to most Node.js developers
- Well-documented

**Cons:**
- Slower than pnpm (no content-addressable store)
- No built-in task runner
- Larger node_modules footprint

**Verdict:** Rejected - pnpm offers better performance and disk efficiency.

### Alternative 3: Nx

**Pros:**
- Mature ecosystem
- Advanced caching
- Built-in code generation
- Rich plugin ecosystem

**Cons:**
- Steeper learning curve
- Heavier configuration
- More complex than needed for our scope
- Lock-in to Nx-specific patterns

**Verdict:** Rejected - too heavy for our relatively simple setup.

### Alternative 4: pnpm workspaces alone

**Pros:**
- Simple and lightweight
- Fast and disk-efficient

**Cons:**
- No task orchestration
- No build caching across packages
- Manual dependency management for builds

**Verdict:** Rejected - Turborepo adds valuable pipeline and caching capabilities.

## Consequences

### Positive

1. **Efficient dependency management** - pnpm's content-addressable store deduplicates packages across the monorepo
2. **Fast builds** - Turborepo's remote caching and parallel execution speed up CI/CD
3. **Shared code** - `@rafineri/shared` package provides types and schemas to all apps
4. **Consistent tooling** - Single TypeScript, ESLint, and Prettier configuration
5. **Atomic changes** - Cross-cutting features can be implemented in a single PR
6. **Clear boundaries** - Apps in `apps/` and shared code in `packages/`

### Negative

1. **Initial complexity** - Team needs to understand workspace linking and Turborepo concepts
2. **Build dependencies** - Changes to shared packages require rebuilding dependents
3. **Docker complexity** - Multi-stage builds need to account for workspace structure
4. **Vendor lock-in** - Migration to another monorepo tool would require effort

### Mitigations

- Document workspace commands in README
- Use Turborepo's affected detection to only build changed packages
- Provide Docker Compose setup for consistent local development

## Related Decisions

- [ADR 002: NestJS for API](./002-nestjs-for-api.md)
- [ADR 003: Drizzle ORM](./003-drizzle-orm.md)
- [ADR 004: BullMQ for Workers](./004-bullmq-for-workers.md)

## References

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo)
- [Monorepo.tools](https://monorepo.tools/)

---

**Date:** 2024-01  
**Author:** Rafineri Team  
**Reviewers:** Engineering Team
