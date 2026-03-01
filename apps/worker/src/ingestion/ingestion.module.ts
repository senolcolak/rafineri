import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HackerNewsService } from './hackernews.service';
import { RedditService } from './reddit.service';

@Module({
  imports: [HttpModule],
  providers: [HackerNewsService, RedditService],
  exports: [HackerNewsService, RedditService],
})
export class IngestionModule {}
