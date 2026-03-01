import { Module } from '@nestjs/common';
import { ClusteringService } from './clustering.service';
import { AiModule } from '@/ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [ClusteringService],
  exports: [ClusteringService],
})
export class ClusteringModule {}
