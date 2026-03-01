import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { MockScoringService } from './mock-scoring.service';

@Module({
  providers: [ScoringService, MockScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
