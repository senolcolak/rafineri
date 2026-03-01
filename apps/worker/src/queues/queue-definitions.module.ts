import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

// Queue names (cannot contain ':')
export const QUEUE_NAMES = {
  HN_INGEST: 'hn-ingest',
  REDDIT_INGEST: 'reddit-ingest',
  STORY_CLUSTER: 'story-cluster',
  STORY_SCORE: 'story-score',
  STORY_THUMBNAIL: 'story-thumbnail',
  THUMBNAIL_REFRESH: 'thumbnail-refresh',
} as const;

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.HN_INGEST },
      { name: QUEUE_NAMES.REDDIT_INGEST },
      { name: QUEUE_NAMES.STORY_CLUSTER },
      { name: QUEUE_NAMES.STORY_SCORE },
      { name: QUEUE_NAMES.STORY_THUMBNAIL },
      { name: QUEUE_NAMES.THUMBNAIL_REFRESH },
    ),
  ],
  exports: [BullModule],
})
export class QueueDefinitionsModule {}
