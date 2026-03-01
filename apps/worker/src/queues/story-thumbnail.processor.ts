import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import { QUEUE_NAMES } from './queue-definitions.module';

export interface StoryThumbnailJobData {
  storyId: string;
  url: string;
}

@Processor(QUEUE_NAMES.STORY_THUMBNAIL, {
  concurrency: 5,
})
export class StoryThumbnailProcessor extends WorkerHost {
  private readonly logger = new Logger(StoryThumbnailProcessor.name);

  constructor(private readonly thumbnailService: ThumbnailService) {
    super();
  }

  async process(job: Job<StoryThumbnailJobData>): Promise<void> {
    this.logger.log(`Processing thumbnail job ${job.id} for story ${job.data.storyId}`);
    
    try {
      const thumbnailUrl = await this.thumbnailService.extractThumbnail(
        job.data.storyId,
        job.data.url
      );
      this.logger.log(`Thumbnail job ${job.id} completed: ${thumbnailUrl}`);
    } catch (error) {
      this.logger.error(`Thumbnail job ${job.id} failed:`, error);
      // Don't throw - thumbnail extraction failures shouldn't block the pipeline
      // The service already falls back to placeholder
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
