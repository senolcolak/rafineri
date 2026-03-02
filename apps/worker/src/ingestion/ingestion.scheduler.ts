import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues/queue-names';

@Injectable()
export class IngestionScheduler {
  private readonly logger = new Logger(IngestionScheduler.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.HN_INGEST) private readonly hnQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REDDIT_INGEST) private readonly redditQueue: Queue,
  ) {}

  /**
   * Ingest HackerNews stories every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async triggerHNIngestion(): Promise<void> {
    this.logger.log('Triggering scheduled HackerNews ingestion');
    
    try {
      await this.hnQueue.add('ingest-top-stories', {
        batchSize: 30,
      }, {
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // 1 minute
        },
      });
      
      this.logger.log('HN ingestion job queued successfully');
    } catch (error) {
      this.logger.error('Failed to queue HN ingestion:', (error as Error).message);
    }
  }

  /**
   * Ingest Reddit posts every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async triggerRedditIngestion(): Promise<void> {
    this.logger.log('Triggering scheduled Reddit ingestion');
    
    try {
      await this.redditQueue.add('ingest-subreddits', {
        subreddits: ['technology', 'news', 'worldnews', 'science'],
        limit: 25,
      }, {
        priority: 1,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
      });
      
      this.logger.log('Reddit ingestion job queued successfully');
    } catch (error) {
      this.logger.error('Failed to queue Reddit ingestion:', (error as Error).message);
    }
  }

  /**
   * Daily full ingestion (more comprehensive)
   */
  @Cron('0 2 * * *') // Every day at 2 AM
  async triggerDailyFullIngestion(): Promise<void> {
    this.logger.log('Triggering daily full ingestion');
    
    try {
      // HN: Get more stories
      await this.hnQueue.add('ingest-full', {
        batchSize: 100,
      }, {
        priority: 2,
      });
      
      // Reddit: More subreddits
      await this.redditQueue.add('ingest-full', {
        subreddits: [
          'technology', 'news', 'worldnews', 'science',
          'programming', 'business', 'politics'
        ],
        limit: 50,
      }, {
        priority: 2,
      });
      
      this.logger.log('Daily full ingestion jobs queued');
    } catch (error) {
      this.logger.error('Failed to queue daily ingestion:', (error as Error).message);
    }
  }
}
