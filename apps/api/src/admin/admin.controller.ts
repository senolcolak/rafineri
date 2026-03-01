import { Controller, Post, Param, UseGuards, ParseIntPipe, Body } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiSecurity,
  ApiBody,
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

  @Post('stories/:id/refresh-thumbnail')
  @ApiOperation({
    summary: 'Refresh story thumbnail',
    description: 'Manually trigger a thumbnail refresh for a specific story. Requires admin token.',
  })
  @ApiParam({
    name: 'id',
    description: 'Story ID',
    type: Number,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Optional URL to use for thumbnail extraction. If not provided, uses the story\'s primary item URL.',
          example: 'https://example.com/article',
        },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Thumbnail refresh queued successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        jobId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid admin token' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  @ApiResponse({ status: 500, description: 'Failed to queue thumbnail refresh' })
  async refreshThumbnail(
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: { url?: string },
  ) {
    this.logger.info({ storyId: id, url: body?.url }, 'Admin triggering thumbnail refresh');
    return this.adminService.refreshThumbnail(id, body?.url);
  }

  @Post('thumbnails/refresh-all')
  @ApiOperation({
    summary: 'Refresh thumbnails for trending stories',
    description: 'Manually trigger thumbnail refresh for top trending stories. Requires admin token.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of stories to refresh',
          example: 50,
          default: 100,
        },
        force: {
          type: 'boolean',
          description: 'Force refresh even if thumbnails are not expired',
          example: false,
          default: false,
        },
      },
    },
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Thumbnail refresh jobs queued successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        queued: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid admin token' })
  @ApiResponse({ status: 500, description: 'Failed to queue thumbnail refreshes' })
  async refreshAllThumbnails(
    @Body() body?: { limit?: number; force?: boolean },
  ) {
    this.logger.info({ limit: body?.limit, force: body?.force }, 'Admin triggering bulk thumbnail refresh');
    return this.adminService.refreshAllThumbnails(body?.limit, body?.force);
  }
}
