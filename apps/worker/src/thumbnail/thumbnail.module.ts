import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThumbnailService } from './thumbnail.service';
import { GradientPlaceholderService } from './gradient-placeholder.service';
import { ThumbnailRefreshScheduler } from './thumbnail-refresh.scheduler';
import { ThumbnailRefreshProcessor } from '../queues/thumbnail-refresh.processor';
import { DatabaseModule } from '../config/database.module';
import { QueueDefinitionsModule } from '../queues/queue-definitions.module';
import { RedisService } from '../config/redis.service';

@Module({
  imports: [ConfigModule, DatabaseModule, QueueDefinitionsModule],
  providers: [
    RedisService,
    ThumbnailService,
    GradientPlaceholderService,
    ThumbnailRefreshScheduler,
    ThumbnailRefreshProcessor,
  ],
  exports: [ThumbnailService, GradientPlaceholderService, ThumbnailRefreshScheduler],
})
export class ThumbnailModule {}
