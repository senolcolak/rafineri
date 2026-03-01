import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './config/database.module';
import { QueueDefinitionsModule } from './queues/queue-definitions.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ClusteringModule } from './clustering/clustering.module';
import { ScoringModule } from './scoring/scoring.module';
import { ThumbnailModule } from './thumbnail/thumbnail.module';
import { AiModule } from './ai/ai.module';
import appConfig from './config/app.config';
import redisConfig from './config/redis.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig],
      envFilePath: ['.env', '.env.local'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
          db: configService.get('redis.db'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    QueueDefinitionsModule,
    IngestionModule,
    ClusteringModule,
    ScoringModule,
    ThumbnailModule,
    AiModule,
  ],
})
export class AppModule {}
