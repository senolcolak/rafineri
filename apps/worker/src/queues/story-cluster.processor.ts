import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClusteringService } from '../clustering/clustering.service';
import { QUEUE_NAMES } from './queue-definitions.module';

export interface StoryClusterJobData {
  itemIds?: string[];
  force?: boolean;
}

@Processor(QUEUE_NAMES.STORY_CLUSTER, {
  concurrency: 2,
})
export class StoryClusterProcessor extends WorkerHost {
  private readonly logger = new Logger(StoryClusterProcessor.name);

  constructor(private readonly clusteringService: ClusteringService) {
    super();
  }

  async process(job: Job<StoryClusterJobData>): Promise<void> {
    this.logger.log(`Processing story cluster job ${job.id}`);
    
    try {
      const result = await this.clusteringService.clusterItems(job.data);
      this.logger.log(
        `Story cluster job ${job.id} completed: ${result.clusteredCount} items clustered into ${result.storyCount} stories`
      );
    } catch (error) {
      this.logger.error(`Story cluster job ${job.id} failed:`, error);
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
