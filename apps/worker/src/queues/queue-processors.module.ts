import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './queue-names';
import { HNIngestProcessor } from './hn-ingest.processor';
import { RedditIngestProcessor } from './reddit-ingest.processor';
import { StoryClusterProcessor } from './story-cluster.processor';
import { StoryScoreProcessor } from './story-score.processor';
import { StoryThumbnailProcessor } from './story-thumbnail.processor';
import { IngestionModule } from '../ingestion/ingestion.module';
import { ClusteringModule } from '../clustering/clustering.module';
import { ScoringModule } from '../scoring/scoring.module';
import { ThumbnailModule } from '../thumbnail/thumbnail.module';

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
    IngestionModule,
    ClusteringModule,
    ScoringModule,
    ThumbnailModule,
  ],
  providers: [
    HNIngestProcessor,
    RedditIngestProcessor,
    StoryClusterProcessor,
    StoryScoreProcessor,
    StoryThumbnailProcessor,
  ],
})
export class QueueProcessorsModule {}
