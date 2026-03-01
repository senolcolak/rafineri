import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { StoriesService } from './stories.service';
import { TrendingQueryDto, TrendingSort } from './dto/trending.dto';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';

@ApiTags('Stories')
@Controller('v1/stories')
@UseInterceptors(TransformInterceptor)
export class StoriesController {
  constructor(
    private readonly storiesService: StoriesService,
    private readonly logger: Logger,
  ) {}

  @Get('trending')
  @ApiOperation({
    summary: 'Get trending stories',
    description: 'Retrieve trending stories with various sorting options and filters',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['hot', 'most_verified', 'most_contested', 'newest'],
    description: 'Sort order for trending stories',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category slug',
  })
  @ApiQuery({
    name: 'label',
    required: false,
    enum: ['verified', 'likely', 'contested', 'unverified'],
    description: 'Filter by verifiability label',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search query string',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of trending stories',
  })
  async getTrending(
    @Query('sort') sort: TrendingSort = 'hot',
    @Query('category') category?: string,
    @Query('label') label?: 'verified' | 'likely' | 'contested' | 'unverified',
    @Query('q') q?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    const query: TrendingQueryDto = {
      sort,
      category,
      label,
      q,
      page,
      limit: Math.min(limit, 100),
    };

    this.logger.debug({ query }, 'Getting trending stories');
    return this.storiesService.getTrending(query);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get all categories',
    description: 'Retrieve all available story categories',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
  })
  async getCategories() {
    this.logger.debug('Getting categories');
    return this.storiesService.getCategories();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get story details',
    description: 'Retrieve detailed information about a specific story',
  })
  @ApiParam({
    name: 'id',
    description: 'Story ID',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Story details',
  })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStory(@Param('id', ParseIntPipe) id: number) {
    this.logger.debug({ storyId: id }, 'Getting story details');
    return this.storiesService.getStory(id);
  }

  @Get(':id/claims')
  @ApiOperation({
    summary: 'Get story claims',
    description: 'Retrieve all claims associated with a story',
  })
  @ApiParam({
    name: 'id',
    description: 'Story ID',
    type: Number,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of claims',
  })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStoryClaims(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    this.logger.debug({ storyId: id, page, limit }, 'Getting story claims');
    return this.storiesService.getStoryClaims(id, page, Math.min(limit, 100));
  }

  @Get(':id/evidence')
  @ApiOperation({
    summary: 'Get story evidence',
    description: 'Retrieve all evidence associated with a story',
  })
  @ApiParam({
    name: 'id',
    description: 'Story ID',
    type: Number,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of evidence',
  })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStoryEvidence(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    this.logger.debug({ storyId: id, page, limit }, 'Getting story evidence');
    return this.storiesService.getStoryEvidence(id, page, Math.min(limit, 100));
  }

  @Get(':id/events')
  @ApiOperation({
    summary: 'Get story events timeline',
    description: 'Retrieve the event timeline for a story',
  })
  @ApiParam({
    name: 'id',
    description: 'Story ID',
    type: Number,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of events',
  })
  @ApiResponse({ status: 404, description: 'Story not found' })
  async getStoryEvents(
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
  ) {
    this.logger.debug({ storyId: id, page, limit }, 'Getting story events');
    return this.storiesService.getStoryEvents(id, page, Math.min(limit, 100));
  }
}
