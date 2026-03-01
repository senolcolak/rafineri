/**
 * Cross-Check Module
 * 
 * Provides multi-source verification services for truth validation.
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CrossCheckService } from './cross-check.service';
import { WikipediaValidator } from './wikipedia.validator';
import { GoogleFactCheckValidator } from './google-factcheck.validator';
import { NewsApiValidator } from './newsapi.validator';
import { HttpValidator } from './http.validator';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 5,
    }),
  ],
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
