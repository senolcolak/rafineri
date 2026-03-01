# ADR 004: BullMQ for Background Job Processing

## Status

✅ **Accepted**

## Context

Rafineri requires robust background job processing for:

1. **Ingestion Jobs** - Periodic fetching from Hacker News, Reddit
2. **Clustering Jobs** - AI-powered grouping of items into stories
3. **Scoring Jobs** - LLM analysis for verifiability scoring
4. **Thumbnail Jobs** - Generating story thumbnails

Requirements:
- Reliable job processing with retries
- Job scheduling (cron-like)
- Priority queues
- Job progress tracking
- Dead letter queue for failed jobs
- Horizontal scalability
- TypeScript support
- NestJS integration

## Decision

We will use **BullMQ** for background job processing.

### Queue Configuration

```typescript
// apps/worker/src/queues/queue-definitions.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'ingestion' },
      { name: 'clustering' },
      { name: 'scoring' },
      { name: 'thumbnail' },
    ),
  ],
  exports: [BullModule],
})
export class QueueDefinitionsModule {}
```

### Producer (API)

```typescript
@Injectable()
export class StoriesService {
  constructor(
    @InjectQueue('scoring') private scoringQueue: Queue,
  ) {}

  async triggerRescore(storyId: string) {
    await this.scoringQueue.add('score-story', { storyId }, {
      priority: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}
```

### Consumer (Worker)

```typescript
@Processor('clustering', { concurrency: 5 })
export class ClusteringProcessor {
  constructor(private clusteringService: ClusteringService) {}

  @Process('cluster-item')
  async handleClusterItem(job: Job<Item>) {
    const { id, title, content } = job.data;
    
    await job.updateProgress(10);
    
    const embedding = await this.clusteringService.generateEmbedding(title + ' ' + content);
    await job.updateProgress(50);
    
    const story = await this.clusteringService.findOrCreateStory(embedding);
    await job.updateProgress(100);
    
    return { storyId: story.id };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    console.error(`Job ${job.id} failed:`, error.message);
  }
}
```

## Alternatives Considered

### Alternative 1: Bull (v3)

**Pros:**
- Mature and battle-tested
- Large community
- Same API as BullMQ

**Cons:**
- Uses older Redis commands (not optimized)
- No built-in TypeScript support
- Slower than BullMQ
- Maintenance mode (new features go to BullMQ)

**Verdict:** Rejected - BullMQ is the modern successor with better performance.

### Alternative 2: Agenda

**Pros:**
- Job persistence in MongoDB
- Human-friendly cron syntax
- Good for job definition

**Cons:**
- Requires MongoDB (we use PostgreSQL/Redis)
- Slower than Redis-based queues
- Less suitable for high-throughput

**Verdict:** Rejected - Requires additional database, not as performant.

### Alternative 3: node-cron + In-Memory

**Pros:**
- Simple for basic scheduling
- No Redis required
- Lightweight

**Cons:**
- No persistence (jobs lost on restart)
- No distributed processing
- No job progress tracking
- No retry mechanism
- Not suitable for production workloads

**Verdict:** Rejected - Not reliable enough for production.

### Alternative 4: AWS SQS / Google Cloud Tasks

**Pros:**
- Fully managed
- Auto-scaling
- No infrastructure to maintain

**Cons:**
- Vendor lock-in
- Higher latency
- Cost at scale
- Less control over job processing
- Complex local development

**Verdict:** Rejected - We prefer infrastructure we can run locally and control.

### Alternative 5: RabbitMQ

**Pros:**
- Mature message broker
- Multiple protocol support
- Good for complex routing

**Cons:**
- Additional infrastructure to maintain
- More complex than needed
- No built-in job scheduling
- Overkill for our use case

**Verdict:** Rejected - We already use Redis; BullMQ leverages existing infrastructure.

### Alternative 6: Temporal / Cadence

**Pros:**
- Durable execution
- Complex workflow support
- Fault-tolerant

**Cons:**
- Heavy infrastructure requirements
- Steep learning curve
- Overkill for our relatively simple jobs

**Verdict:** Rejected - Too complex for our current needs.

## Consequences

### Positive

1. **Redis-backed** - Leverages existing Redis infrastructure
2. **High performance** - Optimized for throughput and low latency
3. **TypeScript support** - First-class TypeScript types
4. **NestJS integration** - Official `@nestjs/bullmq` package
5. **Job features** - Delays, priorities, retries, cron, rate limiting
6. **Observability** - Job progress, metrics, events
7. **Scalable** - Multiple workers can process from same queue
8. **Reliable** - At-least-once delivery, stalled job detection
9. **Flow support** - Can chain jobs into workflows
10. **Active development** - Well-maintained by the same team as Bull

### Negative

1. **Redis dependency** - Requires Redis (already in our stack)
2. **Memory usage** - Redis memory can grow with large queues
3. **No job history by default** - Completed jobs removed (configurable)
4. **Learning curve** - Understanding jobs, queues, workers, schedulers
5. **Monitoring** - Need additional tools for queue monitoring (GUI, etc.)

### Mitigations

- Use Redis memory policies to handle queue growth
- Implement custom job history if needed
- Set up Bull Board or similar for monitoring
- Document job patterns in team wiki

## Implementation Details

### Queue Configuration

```typescript
// apps/worker/src/app.module.ts
BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    connection: {
      host: config.get('redis.host'),
      port: config.get('redis.port'),
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50,      // Keep last 50 failed jobs
    },
  }),
  inject: [ConfigService],
});
```

### Job Scheduling

```typescript
// Scheduled ingestion
@Injectable()
export class IngestionScheduler {
  constructor(
    @InjectQueue('ingestion') private ingestionQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleIngestion() {
    await this.ingestionQueue.add('fetch-hackernews', {}, {
      jobId: 'hn-ingestion', // Deduplication
    });
    
    await this.ingestionQueue.add('fetch-reddit', {}, {
      jobId: 'reddit-ingestion',
    });
  }
}
```

### Error Handling

```typescript
@Processor('scoring')
export class ScoringProcessor {
  private readonly logger = new Logger(ScoringProcessor.name);

  @Process('score-story')
  async handleScoring(job: Job<ScoringJobData>) {
    try {
      return await this.scoringService.scoreStory(job.data.storyId);
    } catch (error) {
      this.logger.error(`Scoring failed for story ${job.data.storyId}`, error);
      
      // Will be retried based on job options
      throw error;
    }
  }

  @OnQueueFailed()
  handleFailure(job: Job, error: Error) {
    // Alerting/notification logic
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      this.sendToDeadLetterQueue(job, error);
    }
  }

  private sendToDeadLetterQueue(job: Job, error: Error) {
    // Persist failed job for manual review
  }
}
```

### Monitoring

For production monitoring, consider:
- **Bull Board** - Web UI for queue inspection
- **BullMQ Prometheus exporter** - Metrics for Grafana
- **Custom health checks** - Queue depth alerts

```typescript
// Health check endpoint
@Get('health/queues')
async checkQueues() {
  const queues = ['ingestion', 'clustering', 'scoring'];
  const statuses = await Promise.all(
    queues.map(async (name) => {
      const queue = new Queue(name);
      const waiting = await queue.getWaitingCount();
      const active = await queue.getActiveCount();
      const failed = await queue.getFailedCount();
      await queue.close();
      return { name, waiting, active, failed };
    })
  );
  return statuses;
}
```

## Queue Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BULLMQ QUEUE ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │    Redis    │
                              │             │
                              │  ┌───────┐  │
                              │  │ List  │  │ ◀── ingestion:wait
                              │  ├───────┤  │ ◀── ingestion:active
                              │  ├───────┤  │ ◀── ingestion:completed
                              │  ├───────┤  │ ◀── ingestion:failed
                              │  └───────┘  │ ◀── ingestion:delayed
                              └──────┬──────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
          ▼                          ▼                          ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Ingestion Worker │      │Clustering Worker │      │  Scoring Worker  │
│                  │      │                  │      │                  │
│ • Fetches HN     │      │ • Generates      │      │ • LLM analysis   │
│ • Fetches Reddit │      │   embeddings     │      │ • Assigns labels │
│ • Stores items   │      │ • Groups items   │      │ • Updates scores │
└──────────────────┘      └──────────────────┘      └──────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │                          JOB LIFECYCLE                               │
  │                                                                      │
  │  ┌────────┐   ┌────────┐   ┌────────┐   ┌──────────┐   ┌─────────┐  │
  │  │        │──▶│        │──▶│        │──▶│          │──▶│         │  │
  │  │waiting │   │delayed │   │active  │   │completed │   │removed  │  │
  │  │        │   │        │   │        │   │          │   │         │  │
  │  └────────┘   └────────┘   └───┬────┘   └──────────┘   └─────────┘  │
  │      │                         │                                   │
  │      │                         │         ┌──────────┐              │
  │      │                         └────────▶│          │              │
  │      │                                   │ failed   │──────────────┘
  │      │                                   │          │ (retry)
  │      │                                   └──────────┘
  │      │                                         │
  │      │                                         ▼
  │      │                                   ┌──────────┐
  │      └──────────────────────────────────│ stalled  │
  │                                         │          │
  │                                         └──────────┘
  └──────────────────────────────────────────────────────────────────────┘
```

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [NestJS BullMQ Integration](https://docs.nestjs.com/techniques/queues)
- [BullMQ vs Bull Comparison](https://docs.bullmq.io/bullmq-pro/compare)
- [Bull Board](https://github.com/felixmosh/bull-board) - Queue monitoring UI

---

**Date:** 2024-01  
**Author:** Rafineri Team  
**Reviewers:** Engineering Team
