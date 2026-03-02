import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CrossCheckService } from './cross-check.service';
import { WikipediaValidator } from './wikipedia.validator';
import { GoogleFactCheckValidator } from './google-factcheck.validator';
import { NewsApiValidator } from './newsapi.validator';
import { HttpValidator } from './http.validator';

@Module({
  imports: [ConfigModule],
  providers: [
    CrossCheckService,
    WikipediaValidator,
    GoogleFactCheckValidator,
    NewsApiValidator,
    HttpValidator,
  ],
  exports: [CrossCheckService, HttpValidator],
})
export class CrossCheckModule {}
