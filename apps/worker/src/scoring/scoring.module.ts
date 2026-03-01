import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { MockScoringService } from './mock-scoring.service';
import { AiModule } from '@/ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [ScoringService, MockScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
