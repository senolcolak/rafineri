import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { QueueDefinitionsModule } from '../queues/queue-definitions.module';
import { RedisService } from '../config/redis.service';
import { HackerNewsService } from './hackernews.service';
import { RedditService } from './reddit.service';
import { IngestionScheduler } from './ingestion.scheduler';
import { IngestionTriggerSubscriber } from './ingestion-trigger.subscriber';

@Module({
  imports: [HttpModule, QueueDefinitionsModule, ConfigModule],
  providers: [HackerNewsService, RedditService, IngestionScheduler, IngestionTriggerSubscriber, RedisService],
  exports: [HackerNewsService, RedditService],
})
export class IngestionModule {}
