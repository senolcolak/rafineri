import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RedditService } from '../ingestion/reddit.service';
import { QUEUE_NAMES } from './queue-definitions.module';

export interface RedditIngestJobData {
  subreddits?: string[];
  limit?: number;
}

@Processor(QUEUE_NAMES.REDDIT_INGEST, {
  concurrency: 2,
})
export class RedditIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(RedditIngestProcessor.name);

  constructor(private readonly redditService: RedditService) {
    super();
  }

  async process(job: Job<RedditIngestJobData>): Promise<void> {
    this.logger.log(`Processing Reddit ingest job ${job.id}`);
    
    try {
      const result = await this.redditService.ingest(job.data);
      
      if (result.skipped) {
        this.logger.warn(`Reddit ingest job ${job.id} skipped: ${result.reason}`);
        return;
      }
      
      this.logger.log(`Reddit ingest job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Reddit ingest job ${job.id} failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error:`, error.message);
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error('Worker error:', error);
  }
}
