import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './queue-names';

export { QUEUE_NAMES };

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.HN_INGEST },
      { name: QUEUE_NAMES.REDDIT_INGEST },
      { name: QUEUE_NAMES.STORY_CLUSTER },
      { name: QUEUE_NAMES.STORY_SCORE },
      { name: QUEUE_NAMES.STORY_THUMBNAIL },
      { name: QUEUE_NAMES.THUMBNAIL_REFRESH },
      { name: QUEUE_NAMES.APPROVAL },
    ),
  ],
  exports: [BullModule],
})
export class QueueDefinitionsModule {}
