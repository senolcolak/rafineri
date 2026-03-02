import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HNIngestProcessor } from './hn-ingest.processor';
import { RedditIngestProcessor } from './reddit-ingest.processor';
import { StoryClusterProcessor } from './story-cluster.processor';
import { StoryScoreProcessor } from './story-score.processor';
import { StoryThumbnailProcessor } from './story-thumbnail.processor';

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
  providers: [
    HNIngestProcessor,
    RedditIngestProcessor,
    StoryClusterProcessor,
    StoryScoreProcessor,
    StoryThumbnailProcessor,
  ],
  exports: [BullModule],
})
export class QueueDefinitionsModule {}
