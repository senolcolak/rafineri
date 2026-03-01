import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RedisService } from '@/database/redis.service';
import { StoriesModule } from '@/stories/stories.module';

@Module({
  imports: [StoriesModule],
  controllers: [AdminController],
  providers: [AdminService, RedisService],
  exports: [AdminService],
})
export class AdminModule {}
