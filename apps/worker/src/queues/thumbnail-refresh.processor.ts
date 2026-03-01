import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import { QUEUE_NAMES } from './queue-definitions.module';
import { stories } from '../database/schema';
import { DATABASE_PROVIDER, Database } from '../config/database.module';

export interface ThumbnailRefreshJobData {
  storyId: string;
  url: string;
}

@Processor(QUEUE_NAMES.THUMBNAIL_REFRESH, {
  concurrency: 3,
})
export class ThumbnailRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(ThumbnailRefreshProcessor.name);

  constructor(
    private readonly thumbnailService: ThumbnailService,
    @Inject(DATABASE_PROVIDER) private readonly db: Database,
  ) {
    super();
  }

  async process(job: Job<ThumbnailRefreshJobData>): Promise<void> {
    const { storyId, url } = job.data;
    
    this.logger.log(`Processing thumbnail refresh job ${job.id} for story ${storyId}`);
    
    try {
      // Fetch and generate new thumbnail
      const thumbnailUrl = await this.thumbnailService.extractThumbnail(storyId, url);
      
      // Update the story with the new thumbnail and refresh timestamp
      await this.updateStoryThumbnail(storyId, thumbnailUrl);
      
      this.logger.log(
        `Thumbnail refresh job ${job.id} completed for story ${storyId}: ${thumbnailUrl}`
      );
    } catch (error) {
      this.logger.error(
        `Thumbnail refresh job ${job.id} failed for story ${storyId}:`,
        error
      );
      // Re-throw to trigger retry logic
      throw error;
    }
  }

  private async updateStoryThumbnail(storyId: string, thumbnailUrl: string): Promise<void> {
    try {
      const now = new Date();
      
      await this.db
        .update(stories)
        .set({
          thumbnailUrl,
          lastThumbnailRefresh: now,
          updatedAt: now,
        })
        .where(eq(stories.id, parseInt(storyId, 10)));

      this.logger.debug(`Updated thumbnail for story ${storyId}: ${thumbnailUrl}`);
    } catch (error) {
      this.logger.error(`Failed to update thumbnail for story ${storyId}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Thumbnail refresh job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Thumbnail refresh job ${job.id} failed with error:`,
      error.message
    );
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error('Thumbnail refresh worker error:', error);
  }
}
