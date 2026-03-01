# ADR 002: NestJS for API and Worker Services

## Status

✅ **Accepted**

## Context

We needed to choose a framework for building:
1. **API Service** - RESTful API with Swagger documentation, validation, and authentication
2. **Worker Service** - Background job processors with queue management

Key requirements:
- TypeScript-first development
- Dependency injection for testability
- Structured, maintainable codebase
- Built-in support for OpenAPI/Swagger
- Queue/background job capabilities
- Strong ecosystem and community support

## Decision

We will use **NestJS** for both the API and Worker services.

### API Service

```typescript
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  @ApiResponse({ type: [StoryDto] })
  async findAll(@Query() query: ListStoriesDto) {
    return this.storiesService.findAll(query);
  }
}
```

### Worker Service

```typescript
@Processor('clustering')
export class ClusteringProcessor {
  constructor(private readonly clusteringService: ClusteringService) {}

  @Process('cluster-item')
  async handleClusterItem(job: Job<Item>) {
    return this.clusteringService.processItem(job.data);
  }
}
```

## Alternatives Considered

### Alternative 1: Express.js + Manual Structure

**Pros:**
- Lightweight and flexible
- Most popular Node.js framework
- Large ecosystem of middleware

**Cons:**
- Requires manual architecture decisions
- No built-in DI container
- No standardized project structure
- More boilerplate for common patterns
- Manual OpenAPI documentation

**Verdict:** Rejected - too much boilerplate and lack of structure for our needs.

### Alternative 2: Fastify

**Pros:**
- Excellent performance
- Built-in validation with JSON Schema
- Growing ecosystem

**Cons:**
- Smaller ecosystem than Express
- Less mature decorators/DI ecosystem
- Fewer enterprise patterns documented

**Verdict:** Rejected - while fast, ecosystem maturity was a concern.

### Alternative 3: tRPC

**Pros:**
- End-to-end type safety
- Excellent DX for TypeScript teams
- No code generation needed

**Cons:**
- Tight coupling between client and server
- Less suitable for public APIs
- Smaller ecosystem
- Frontend would need tRPC client

**Verdict:** Rejected - we need a traditional REST API that any client can consume.

### Alternative 4: AdonisJS

**Pros:**
- Full-featured framework
- Similar to Laravel/Rails
- Built-in ORM, auth, and more

**Cons:**
- Different paradigm than our frontend stack
- Smaller community than NestJS
- Less ecosystem for queue processing

**Verdict:** Rejected - NestJS has better alignment with our architecture and more mature queue integrations.

### Alternative 5: Pure Node.js (no framework)

**Pros:**
- Maximum control
- No framework overhead
- Small bundle size

**Cons:**
- Excessive boilerplate
- Reinventing common patterns
- Difficult to onboard developers
- Testing complexity

**Verdict:** Rejected - not practical for our timeline and team size.

## Consequences

### Positive

1. **TypeScript-native** - First-class TypeScript support with decorators
2. **Dependency Injection** - Built-in IoC container for testable code
3. **Modular architecture** - Clear module boundaries with `@Module()`
4. **Swagger/OpenAPI** - Auto-generated API docs via `@nestjs/swagger`
5. **Queue integration** - Official `@nestjs/bullmq` package
6. **Validation** - Integrated with `class-validator` and `class-transformer`
7. **Ecosystem** - Rich ecosystem of official and community packages
8. **Documentation** - Excellent official documentation
9. **Team familiarity** - Similar to Angular patterns many developers know
10. **Consistency** - Same framework for API and Worker (shared patterns)

### Negative

1. **Learning curve** - Decorators and DI concepts for new team members
2. **Runtime overhead** - Reflection metadata adds some overhead
3. **Verbose** - More boilerplate than minimal frameworks
4. **Bundle size** - Larger than Express for serverless (not our concern)
5. **Magic** - Some developers dislike the "magic" of decorators

### Mitigations

- Comprehensive onboarding documentation
- Clear coding standards and examples
- Use `strict` TypeScript mode for type safety

## Implementation Notes

### Key NestJS Features We Use

| Feature | Package | Purpose |
|---------|---------|---------|
| Core | `@nestjs/core` | Framework foundation |
| Platform | `@nestjs/platform-express` | HTTP server adapter |
| Config | `@nestjs/config` | Environment configuration |
| Swagger | `@nestjs/swagger` | API documentation |
| Throttler | `@nestjs/throttler` | Rate limiting |
| BullMQ | `@nestjs/bullmq` | Queue processing |
| Pino | `nestjs-pino` | Structured logging |

### Project Structure

```
api/src/
├── main.ts              # Application bootstrap
├── app.module.ts        # Root module
├── stories/             # Feature module
│   ├── stories.controller.ts
│   ├── stories.service.ts
│   ├── stories.module.ts
│   └── dto/
├── common/              # Cross-cutting concerns
│   ├── guards/          # Auth guards
│   ├── filters/         # Exception filters
│   ├── interceptors/    # Logging, transformation
│   └── pipes/           # Validation pipes
└── config/              # Configuration modules
```

### Testing Strategy

```typescript
// Unit test with dependency injection
describe('StoriesService', () => {
  let service: StoriesService;
  let repository: MockType<Repository<Story>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StoriesService,
        { provide: getRepositoryToken(Story), useFactory: repositoryMockFactory },
      ],
    }).compile();

    service = module.get(StoriesService);
    repository = module.get(getRepositoryToken(Story));
  });

  it('should return stories', async () => {
    repository.find.mockReturnValue([mockStory]);
    expect(await service.findAll()).toEqual([mockStory]);
  });
});
```

## References

- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS Architecture](https://docs.nestjs.com/fundamentals/custom-providers)
- [BullMQ with NestJS](https://docs.nestjs.com/techniques/queues)

---

**Date:** 2024-01  
**Author:** Rafineri Team  
**Reviewers:** Engineering Team
