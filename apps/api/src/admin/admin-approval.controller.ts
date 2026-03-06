import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminGuard } from '@/common/guards/admin.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { CrossCheckService } from '@/cross-check/cross-check.service';
import { HttpValidator } from '@/cross-check/http.validator';
import { HttpCheckRule } from '@/cross-check/cross-check.types';
import { AdminApprovalService } from './admin-approval.service';

class SubmitApprovalDto {
  storyId!: string;
  title?: string;
  content?: string;
  claim!: string;
  sources?: string[];
  idempotencyKey?: string;
}

class ManualDecisionDto {
  decision!: 'approved' | 'rejected';
  reason!: string;
  confidence!: number;
}

class HttpCheckRuleDto {
  config!: {
    name: string;
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: unknown;
    queryParams?: Record<string, string>;
    extractPath?: string;
    matchPattern?: string;
    timeoutMs?: number;
  };
  validationLogic!: 'contains' | 'equals' | 'exists' | 'regex';
  expectedValue?: string;
  weight!: number;
}

@ApiTags('Admin - Approval Workflows')
@ApiSecurity('admin-token')
@Controller('admin/approval')
@UseGuards(AdminGuard)
@UseInterceptors(TransformInterceptor)
export class AdminApprovalController {
  constructor(
    private readonly crossCheckService: CrossCheckService,
    private readonly httpValidator: HttpValidator,
    private readonly approvalService: AdminApprovalService,
  ) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit story for approval workflow (legacy)' })
  @ApiBody({ type: SubmitApprovalDto })
  async submitForApproval(
    @Req() req: Request & { adminUserId?: number },
    @Body() dto: SubmitApprovalDto,
  ) {
    return this.approvalService.submitRequest({
      storyId: Number(dto.storyId),
      claim: dto.claim,
      title: dto.title,
      content: dto.content,
      sources: dto.sources,
      idempotencyKey: dto.idempotencyKey,
      submittedBy: req.adminUserId,
    });
  }

  @Post('process')
  @ApiOperation({ summary: 'Queue approval processing (legacy alias)' })
  @ApiBody({ type: SubmitApprovalDto })
  async processApproval(
    @Req() req: Request & { adminUserId?: number },
    @Body() dto: SubmitApprovalDto,
  ) {
    const submitted = await this.approvalService.submitRequest({
      storyId: Number(dto.storyId),
      claim: dto.claim,
      title: dto.title,
      content: dto.content,
      sources: dto.sources,
      idempotencyKey: dto.idempotencyKey,
      submittedBy: req.adminUserId,
    });

    return {
      storyId: dto.storyId,
      approved: false,
      confidence: 0,
      status: submitted.status,
      reason: 'Request queued for asynchronous processing',
      requestId: submitted.requestId,
    };
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create approval request' })
  @ApiBody({ type: SubmitApprovalDto })
  async createRequest(
    @Req() req: Request & { adminUserId?: number },
    @Body() dto: SubmitApprovalDto,
  ) {
    return this.approvalService.submitRequest({
      storyId: Number(dto.storyId),
      claim: dto.claim,
      title: dto.title,
      content: dto.content,
      sources: dto.sources,
      idempotencyKey: dto.idempotencyKey,
      submittedBy: req.adminUserId,
    });
  }

  @Get('requests')
  @ApiOperation({ summary: 'List approval requests' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listRequests(
    @Query('status') status?: 'queued' | 'processing' | 'awaiting_manual_review' | 'approved' | 'rejected' | 'failed' | 'cancelled',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.approvalService.listRequests({ status, page, limit });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get approval request details' })
  async getRequest(@Param('id', ParseIntPipe) id: number) {
    return this.approvalService.getRequest(id);
  }

  @Post('requests/:id/retry')
  @ApiOperation({ summary: 'Retry failed/cancelled request' })
  async retryRequest(
    @Req() req: Request & { adminUserId?: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.approvalService.retryRequest(id, req.adminUserId);
  }

  @Post('requests/:id/cancel')
  @ApiOperation({ summary: 'Cancel in-flight request' })
  async cancelRequest(
    @Req() req: Request & { adminUserId?: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.approvalService.cancelRequest(id, req.adminUserId);
  }

  @Post('requests/:id/manual-decision')
  @ApiOperation({ summary: 'Apply manual approval/rejection decision' })
  async manualDecision(
    @Req() req: Request & { adminUserId?: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ManualDecisionDto,
  ) {
    return this.approvalService.manualDecision(id, {
      decision: dto.decision,
      reason: dto.reason,
      confidence: dto.confidence,
      decidedBy: req.adminUserId,
    });
  }

  @Post('cross-check')
  @ApiOperation({ summary: 'Run cross-check validation only' })
  async runCrossCheck(@Body() dto: { claim: string; context?: string; keywords?: string[] }) {
    return this.crossCheckService.crossCheck({
      claim: dto.claim,
      context: dto.context,
      keywords: dto.keywords,
    });
  }

  @Get('validators')
  @ApiOperation({ summary: 'List available validators' })
  async getValidators() {
    const configs = this.crossCheckService.getValidatorConfigs();
    return configs.map((config) => ({
      name: config.name,
      enabled: config.enabled,
      weight: config.weight,
      description: this.describeValidator(config.name),
    }));
  }

  @Post('http-check')
  @ApiOperation({ summary: 'Test HTTP endpoint for validation' })
  @ApiBody({ type: HttpCheckRuleDto })
  async testHttpCheck(@Body() dto: HttpCheckRuleDto) {
    const rule: HttpCheckRule = {
      name: dto.config.name,
      url: dto.config.url,
      method: dto.config.method,
      headers: dto.config.headers,
      body: dto.config.body,
      queryParams: dto.config.queryParams,
      extractPath: dto.config.extractPath,
      matchPattern: dto.config.matchPattern,
      timeoutMs: dto.config.timeoutMs,
      validationLogic: dto.validationLogic,
      expectedValue: dto.expectedValue,
    };

    return this.httpValidator.testRule(rule);
  }

  private describeValidator(name: string): string {
    const descriptions: Record<string, string> = {
      wikipedia: 'Checks claim against relevant Wikipedia articles',
      'google-factcheck': 'Queries Google Fact Check dataset',
      newsapi: 'Checks coverage across trusted news publishers',
      'http-validator': 'Runs custom HTTP validation rules',
    };
    return descriptions[name] || 'Validator';
  }
}
