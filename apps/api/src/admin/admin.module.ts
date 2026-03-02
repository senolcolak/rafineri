import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminService } from './admin.service';
import { AdminApprovalController } from './admin-approval.controller';
import { RedisService } from '@/database/redis.service';
import { StoriesModule } from '@/stories/stories.module';
import { CrossCheckModule } from '@/cross-check/cross-check.module';

@Module({
  imports: [StoriesModule, CrossCheckModule],
  controllers: [AdminController, AdminAuthController, AdminApprovalController],
  providers: [AdminService, RedisService],
  exports: [AdminService],
})
export class AdminModule {}
