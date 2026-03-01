import { Module } from '@nestjs/common';
import { ClusteringService } from './clustering.service';
import { AiModule } from '@/ai/ai.module';
import { DatabaseModule } from '@/config/database.module';
import { QueueDefinitionsModule } from '@/queues/queue-definitions.module';

@Module({
  imports: [AiModule, DatabaseModule, QueueDefinitionsModule],
  providers: [ClusteringService],
  exports: [ClusteringService],
})
export class ClusteringModule {}
