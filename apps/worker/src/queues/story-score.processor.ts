import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScoringService } from '../scoring/scoring.service';
import { QUEUE_NAMES } from './queue-definitions.module';

export interface StoryScoreJobData {
  storyId: string;
  priority?: number;
}

@Processor(QUEUE_NAMES.STORY_SCORE, {
  concurrency: 2,
})
export class StoryScoreProcessor extends WorkerHost {
  private readonly logger = new Logger(StoryScoreProcessor.name);

  constructor(private readonly scoringService: ScoringService) {
    super();
  }

  async process(job: Job<StoryScoreJobData>): Promise<void> {
    this.logger.log(`Processing story score job ${job.id} for story ${job.data.storyId}`);
    
    try {
      const result = await this.scoringService.scoreStory(job.data.storyId);
      this.logger.log(
        `Story score job ${job.id} completed: label=${result.label}, confidence=${result.confidence}`
      );
    } catch (error) {
      this.logger.error(`Story score job ${job.id} failed:`, error);
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
