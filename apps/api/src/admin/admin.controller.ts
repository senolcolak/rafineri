import { Controller, Post, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiSecurity,
} from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AdminService } from './admin.service';
import { AdminGuard } from '@/common/guards/admin.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { UseInterceptors } from '@nestjs/common';

@ApiTags('Admin')
@ApiSecurity('admin-token')
@Controller('v1/admin')
@UseGuards(AdminGuard)
@UseInterceptors(TransformInterceptor)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly logger: Logger,
  ) {}

  @Post('stories/:id/rescore')
  @ApiOperation({
    summary: 'Rescore a story',
    description: 'Recalculate and update all scores for a specific story. Requires admin token.',
  })
  @ApiParam({
    name: 'id',
    description: 'Story ID',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Story rescored successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid admin token' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async rescoreStory(@Param('id', ParseIntPipe) id: number) {
    this.logger.info({ storyId: id }, 'Admin rescoring story');
    return this.adminService.rescoreStory(id);
  }
}
