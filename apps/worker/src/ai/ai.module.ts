import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OllamaService } from './ollama.service';
import { ScoringService } from './scoring.service';
import { ClusteringService } from './clustering.service';

@Module({
  imports: [ConfigModule],
  providers: [OllamaService, ScoringService, ClusteringService],
  exports: [OllamaService, ScoringService, ClusteringService],
})
export class AiModule {}
