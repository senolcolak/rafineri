import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { ThumbnailService, ThumbnailResult } from '../thumbnail/thumbnail.service';
import { QUEUE_NAMES } from './queue-definitions.module';
import { DATABASE_PROVIDER, Database } from '../config/database.provider';
import { stories } from '@rafineri/shared';
import { eq, sql } from 'drizzle-orm';

export interface StoryThumbnailJobData {
  storyId: string;
  url: string;
  title?: string;
}

@Processor(QUEUE_NAMES.STORY_THUMBNAIL, {
  concurrency: 5,
})
export class StoryThumbnailProcessor extends WorkerHost {
  private readonly logger = new Logger(StoryThumbnailProcessor.name);

  constructor(
    private readonly thumbnailService: ThumbnailService,
    @Inject(DATABASE_PROVIDER) private readonly db: Database,
  ) {
    super();
  }

  async process(job: Job<StoryThumbnailJobData>): Promise<void> {
    this.logger.log(`Processing thumbnail job ${job.id} for story ${job.data.storyId}`);
    
    try {
      const result = await this.thumbnailService.extractThumbnail(
        job.data.storyId,
        job.data.url,
        job.data.title
      );
      
      // Persist thumbnail result to database
      await this.persistThumbnail(job.data.storyId, result);
      
      this.logger.log(`Thumbnail job ${job.id} completed: ${result.thumbnailUrl || 'placeholder'}`);

    } catch (error) {
      this.logger.error(`Thumbnail job ${job.id} failed:`, error);
      // Don't throw - thumbnail extraction failures shouldn't block the pipeline
      // The service already falls back to placeholder
    }
  }

  private async persistThumbnail(storyId: string, result: ThumbnailResult): Promise<void> {
    try {
      const now = new Date();
      
      // Store additional metadata in story_events for debugging
      const eventData = {
        thumbnailUrl: result.thumbnailUrl,
        isPlaceholder: result.isPlaceholder,
        placeholderGradient: result.placeholderGradient,
      };

      await this.db
        .update(stories)
        .set({
          thumbnailUrl: result.thumbnailUrl,
          updatedAt: now,
        })
        .where(eq(stories.id, sql`CAST(${storyId} AS INTEGER)`));

      this.logger.debug(`Persisted thumbnail for story ${storyId}: ${result.thumbnailUrl || 'placeholder'}`);
    } catch (error) {
      this.logger.error(`Failed to persist thumbnail for story ${storyId}:`, error);
      // Don't throw - allow job to complete even if persistence fails
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
