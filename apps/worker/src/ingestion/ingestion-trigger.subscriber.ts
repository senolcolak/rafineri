import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues/queue-definitions.module';
import { RedisService } from '../config/redis.service';

/**
 * Subscriber for manual ingestion triggers from admin panel
 * Listens for Redis pub/sub messages and adds jobs to Bull queues
 */
@Injectable()
export class IngestionTriggerSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestionTriggerSubscriber.name);
  private subscriber: any;

  constructor(
    @InjectQueue(QUEUE_NAMES.HN_INGEST) private readonly hnQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REDDIT_INGEST) private readonly redditQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing ingestion trigger subscriber...');
    try {
      // Create a separate Redis client for subscribing
      const redisClient = this.redisService.getClient();
      
      // Duplicate the client for pub/sub (subscriber needs separate connection)
      this.subscriber = redisClient.duplicate();

      // Handle subscriber connection events
      this.subscriber.on('connect', () => {
        this.logger.log('Subscriber Redis client connected');
      });

      this.subscriber.on('error', (err: Error) => {
        this.logger.error('Subscriber Redis error:', err.message);
      });
      
      // Subscribe to the ingestion trigger channel
      await this.subscriber.subscribe('admin:ingestion:trigger');
      
      this.subscriber.on('message', (channel: string, message: string) => {
        this.logger.log(`Received message on channel ${channel}`);
        this.handleTriggerMessage(message);
      });

      this.logger.log('Ingestion trigger subscriber initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ingestion trigger subscriber:', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe('admin:ingestion:trigger');
      await this.subscriber.quit();
      this.logger.log('Ingestion trigger subscriber destroyed');
    }
  }

  private async handleTriggerMessage(message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      const { sourceType, jobId } = data;

      this.logger.log(`Received ingestion trigger for ${sourceType}, jobId: ${jobId}`);

      if (sourceType === 'hackernews') {
        await this.queueHnIngestion(jobId);
      } else if (sourceType === 'reddit') {
        await this.queueRedditIngestion(jobId);
      } else {
        this.logger.warn(`Unknown source type: ${sourceType}`);
      }
    } catch (error) {
      this.logger.error('Failed to handle ingestion trigger message:', error);
    }
  }

  private async queueHnIngestion(jobId: string): Promise<void> {
    try {
      await this.hnQueue.add('ingest-top-stories', {
        batchSize: 30,
        triggeredBy: 'admin',
        jobId,
      }, {
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
      });
      this.logger.log(`HackerNews ingestion job queued: ${jobId}`);
    } catch (error) {
      this.logger.error('Failed to queue HN ingestion:', error);
    }
  }

  private async queueRedditIngestion(jobId: string): Promise<void> {
    try {
      await this.redditQueue.add('ingest-subreddits', {
        subreddits: ['technology', 'news', 'worldnews', 'science'],
        limit: 25,
        triggeredBy: 'admin',
        jobId,
      }, {
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
      });
      this.logger.log(`Reddit ingestion job queued: ${jobId}`);
    } catch (error) {
      this.logger.error('Failed to queue Reddit ingestion:', error);
    }
  }
}
