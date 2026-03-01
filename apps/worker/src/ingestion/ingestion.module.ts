import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { QueueDefinitionsModule } from '../queues/queue-definitions.module';
import { HackerNewsService } from './hackernews.service';
import { RedditService } from './reddit.service';

@Module({
  imports: [HttpModule, QueueDefinitionsModule],
  providers: [HackerNewsService, RedditService],
  exports: [HackerNewsService, RedditService],
})
export class IngestionModule {}
