import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { MockScoringService } from './mock-scoring.service';
import { AiModule } from '@/ai/ai.module';
import { DatabaseModule } from '@/config/database.module';

@Module({
  imports: [AiModule, DatabaseModule],
  providers: [ScoringService, MockScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
