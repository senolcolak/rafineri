import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { HackerNewsService } from '../ingestion/hackernews.service';
import { QUEUE_NAMES } from './queue-definitions.module';

export interface HNIngestJobData {
  storyIds?: number[];
  batchSize?: number;
}

@Processor(QUEUE_NAMES.HN_INGEST, {
  concurrency: 3,
})
export class HNIngestProcessor extends WorkerHost {
  private readonly logger = new Logger(HNIngestProcessor.name);

  constructor(private readonly hnService: HackerNewsService) {
    super();
  }

  async process(job: Job<HNIngestJobData>): Promise<void> {
    this.logger.log(`Processing HN ingest job ${job.id}`);
    
    try {
      await this.hnService.ingest(job.data);
      this.logger.log(`HN ingest job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`HN ingest job ${job.id} failed:`, error);
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
