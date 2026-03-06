import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiSecurity,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AdminService } from './admin.service';
import { AdminGuard } from '@/common/guards/admin.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { StoriesService } from '@/stories/stories.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { Request } from 'express';

@ApiTags('Admin')
@ApiSecurity('admin-token')
@Controller('admin')
@UseGuards(AdminGuard)
@UseInterceptors(TransformInterceptor)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly storiesService: StoriesService,
    private readonly logger: Logger,
  ) {}

  // ===== DASHBOARD =====

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description: 'Returns overview metrics for the admin dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
  })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  // ===== STORIES =====

  @Post('stories')
  @ApiOperation({
    summary: 'Create new story',
    description: 'Manually create a new story from a URL',
  })
  @ApiBody({ type: CreateStoryDto })
  @ApiResponse({ status: 201, description: 'Story created successfully' })
  async createStory(@Body() dto: CreateStoryDto) {
    return this.adminService.createStory(dto);
  }

  @Get('stories')
  @ApiOperation({
    summary: 'List all stories',
    description: 'Get paginated list of all stories with optional filtering',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiQuery({ name: 'label', required: false, enum: ['verified', 'likely', 'contested', 'unverified'] })
  @ApiResponse({ status: 200, description: 'List of stories' })
  async getStories(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('q') q?: string,
    @Query('label') label?: string,
  ) {
    return this.adminService.getStories({ page, limit, q, label });
  }

  @Get('stories/:id')
  @ApiOperation({
    summary: 'Get story by ID',
    description: 'Get detailed information about a specific story',
  })
  @ApiParam({ name: 'id', description: 'Story ID', type: Number })
  @ApiResponse({ status: 200, description: 'Story details' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStory(@Param('id', ParseIntPipe) id: number) {
    return this.storiesService.getStory(id);
  }

  @Patch('stories/:id')
  @ApiOperation({
    summary: 'Update story',
    description: 'Update story metadata (title, summary, category, label)',
  })
  @ApiParam({ name: 'id', description: 'Story ID', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        category: { type: 'string' },
        label: { type: 'string', enum: ['verified', 'likely', 'contested', 'unverified'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Story updated successfully' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async updateStory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string; summary?: string; category?: string; label?: string },
  ) {
    return this.adminService.updateStory(id, body);
  }

  @Delete('stories/:id')
  @ApiOperation({
    summary: 'Delete story',
    description: 'Permanently delete a story and its related data',
  })
  @ApiParam({ name: 'id', description: 'Story ID', type: Number })
  @ApiResponse({ status: 200, description: 'Story deleted successfully' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async deleteStory(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteStory(id);
  }

  @Post('stories/:id/rescore')
  @ApiOperation({
    summary: 'Rescore a story',
    description: 'Recalculate and update all scores for a specific story.',
  })
  @ApiParam({ name: 'id', description: 'Story ID', type: Number })
  @ApiResponse({ status: 200, description: 'Story rescored successfully' })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async rescoreStory(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.rescoreStory(id);
  }

  @Post('stories/:id/refresh-thumbnail')
  @ApiOperation({
    summary: 'Refresh story thumbnail',
    description: 'Manually trigger a thumbnail refresh for a specific story.',
  })
  @ApiParam({ name: 'id', description: 'Story ID', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Optional URL for thumbnail extraction' },
      },
    },
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Thumbnail refresh queued successfully' })
  async refreshThumbnail(
    @Param('id', ParseIntPipe) id: number,
    @Body() body?: { url?: string },
  ) {
    return this.adminService.refreshThumbnail(id, body?.url);
  }

  // ===== SOURCES =====

  @Get('sources')
  @ApiOperation({
    summary: 'List all sources',
    description: 'Get all content ingestion sources',
  })
  @ApiResponse({ status: 200, description: 'List of sources' })
  async getSources() {
    return this.adminService.getSources();
  }

  @Patch('sources/:id')
  @ApiOperation({
    summary: 'Update source',
    description: 'Enable/disable or update source configuration',
  })
  @ApiParam({ name: 'id', description: 'Source ID', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        isActive: { type: 'boolean' },
        config: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Source updated successfully' })
  async updateSource(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isActive?: boolean; config?: Record<string, unknown> },
  ) {
    return this.adminService.updateSource(id, body);
  }

  @Post('sources/trigger/:type')
  @ApiOperation({
    summary: 'Trigger ingestion for a source type',
    description: 'Manually trigger ingestion for Hacker News or Reddit',
  })
  @ApiParam({ name: 'type', description: 'Source type', enum: ['hackernews', 'reddit'] })
  @ApiResponse({ status: 200, description: 'Ingestion triggered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid source type' })
  async triggerIngestion(@Param('type') type: string) {
    return this.adminService.triggerIngestion(type);
  }

  @Post('sources/pause-all')
  @ApiOperation({
    summary: 'Pause all sources',
    description: 'Disable all content ingestion sources',
  })
  @ApiResponse({ status: 200, description: 'All sources paused' })
  async pauseAllSources() {
    return this.adminService.setAllSourcesActive(false);
  }

  @Post('sources/resume-all')
  @ApiOperation({
    summary: 'Resume all sources',
    description: 'Enable all content ingestion sources',
  })
  @ApiResponse({ status: 200, description: 'All sources resumed' })
  async resumeAllSources() {
    return this.adminService.setAllSourcesActive(true);
  }

  // ===== THUMBNAILS =====

  @Post('thumbnails/refresh-all')
  @ApiOperation({
    summary: 'Refresh thumbnails for trending stories',
    description: 'Manually trigger thumbnail refresh for top trending stories.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of stories to refresh', default: 100 },
        force: { type: 'boolean', description: 'Force refresh even if not expired', default: false },
      },
    },
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Thumbnail refresh jobs queued successfully' })
  async refreshAllThumbnails(
    @Body() body?: { limit?: number; force?: boolean },
  ) {
    return this.adminService.refreshAllThumbnails(body?.limit, body?.force);
  }

  // ===== HEALTH & MONITORING =====

  @Get('health')
  @ApiOperation({
    summary: 'System health check',
    description: 'Get health status of all system components',
  })
  @ApiResponse({ status: 200, description: 'Health status' })
  async getHealth() {
    return this.adminService.getHealthStatus();
  }

  @Get('logs')
  @ApiOperation({
    summary: 'Get system logs',
    description: 'Retrieve recent application logs',
  })
  @ApiQuery({ name: 'lines', required: false, type: Number, description: 'Number of log lines' })
  @ApiResponse({ status: 200, description: 'Log entries' })
  async getLogs(
    @Query('lines', new DefaultValuePipe(100), ParseIntPipe) lines: number,
  ) {
    return this.adminService.getLogs(lines);
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns metrics in Prometheus format',
  })
  @ApiResponse({ status: 200, description: 'Prometheus metrics' })
  async getMetrics() {
    return this.adminService.getMetrics();
  }

  // ===== SETTINGS =====

  @Get('settings')
  @ApiOperation({
    summary: 'Get system settings',
    description: 'Returns current system configuration settings',
  })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update system settings',
    description: 'Update configuration settings',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        hnConcurrency: { type: 'number' },
        hnBatchSize: { type: 'number' },
        redditLimit: { type: 'number' },
        similarityThreshold: { type: 'number' },
        timeWindowHours: { type: 'number' },
        enableHNIngestion: { type: 'boolean' },
        enableRedditIngestion: { type: 'boolean' },
        enableAutoClustering: { type: 'boolean' },
        enableThumbnailRefresh: { type: 'boolean' },
        requireApproval: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateSettings(
    @Req() req: Request & { adminUserId?: number },
    @Body() body: {
      hnConcurrency?: number;
      hnBatchSize?: number;
      redditLimit?: number;
      similarityThreshold?: number;
      timeWindowHours?: number;
      enableHNIngestion?: boolean;
      enableRedditIngestion?: boolean;
      enableAutoClustering?: boolean;
      enableThumbnailRefresh?: boolean;
      requireApproval?: boolean;
      version?: number;
    },
  ) {
    return this.adminService.updateSettings({
      ...body,
      updatedBy: req.adminUserId,
    });
  }
}
