/**
 * Admin Approval Controller
 * 
 * API endpoints for managing approval workflows and cross-check validation.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiBody } from '@nestjs/swagger';
import { AdminGuard } from '@/common/guards/admin.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { CrossCheckService } from '@/cross-check/cross-check.service';
import { HttpValidator } from '@/cross-check/http.validator';
import { HttpCheckRule } from '@/cross-check/cross-check.types';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { eq } from 'drizzle-orm';
import { stories } from '@/database/schema';

// DTOs
class SubmitApprovalDto {
  storyId!: string;
  title!: string;
  content?: string;
  claim!: string;
  sources?: string[];
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

class ProcessWithRulesDto {
  storyId!: string;
  title!: string;
  content?: string;
  claim!: string;
  sources?: string[];
  httpRules!: HttpCheckRuleDto[];
}

class CreateWorkflowDto {
  name!: string;
  description!: string;
  nodes!: Array<{
    id: string;
    type: string;
    name: string;
    config: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  connections!: Array<{
    from: string;
    to: string;
    condition?: string;
  }>;
  trigger!: {
    type: 'manual' | 'scheduled' | 'webhook' | 'event';
    config: Record<string, unknown>;
  };
}

@ApiTags('Admin - Approval Workflows')
@ApiSecurity('admin-token')
@Controller('admin/approval')
@UseGuards(AdminGuard)
@UseInterceptors(TransformInterceptor)
export class AdminApprovalController {
  private readonly logger = new Logger(AdminApprovalController.name);

  constructor(
    private readonly crossCheckService: CrossCheckService,
    private readonly httpValidator: HttpValidator,
    @Inject(DRIZZLE_PROVIDER) private readonly db: Database,
  ) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit story for approval workflow' })
  @ApiBody({ type: SubmitApprovalDto })
  async submitForApproval(@Body() dto: SubmitApprovalDto) {
    this.logger.log(`Submitting story ${dto.storyId} for approval`);

    return {
      success: true,
      data: {
        requestId: `apr-${Date.now()}`,
        status: 'pending',
        message: 'Story submitted for approval',
        estimatedTime: '30-60 seconds',
      },
    };
  }

  @Post('process')
  @ApiOperation({ summary: 'Process story through approval workflow' })
  @ApiBody({ type: SubmitApprovalDto })
  async processApproval(@Body() dto: SubmitApprovalDto) {
    this.logger.log(`Processing approval for story ${dto.storyId}`);

    try {
      // Run cross-check validation
      const crossCheckResult = await this.crossCheckService.crossCheck({
        claim: dto.claim,
        context: dto.content,
        keywords: this.extractKeywords(dto.title, dto.content),
        existingSources: dto.sources,
      });

      // Make approval decision based on cross-check
      const approved = crossCheckResult.overallStatus === 'verified' && crossCheckResult.confidence >= 0.6;
      const rejected = crossCheckResult.overallStatus === 'contradicted' && crossCheckResult.confidence >= 0.5;

      let status: 'approved' | 'rejected' | 'pending-review';
      let reason: string;

      if (approved) {
        status = 'approved';
        reason = `Cross-check verified with ${Math.round(crossCheckResult.confidence * 100)}% confidence`;
      } else if (rejected) {
        status = 'rejected';
        reason = `Cross-check found contradictions: ${crossCheckResult.consensus}`;
      } else {
        status = 'pending-review';
        reason = `Insufficient confidence for auto-approval: ${crossCheckResult.consensus}`;
      }

      return {
        success: true,
        data: {
          storyId: dto.storyId,
          approved,
          confidence: crossCheckResult.confidence,
          status,
          reason,
          checks: {
            crossCheck: crossCheckResult,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Approval processing failed: ${(error as Error).message}`);
      return {
        success: false,
        data: {
          storyId: dto.storyId,
          approved: false,
          confidence: 0,
          status: 'pending-review',
          reason: `Processing failed: ${(error as Error).message}`,
        },
      };
    }
  }

  @Post('process-with-rules')
  @ApiOperation({ summary: 'Process with custom HTTP validation rules' })
  @ApiBody({ type: ProcessWithRulesDto })
  async processWithRules(@Body() dto: ProcessWithRulesDto) {
    this.logger.log(`Processing approval with custom rules for story ${dto.storyId}`);

    try {
      const httpRules: HttpCheckRule[] = dto.httpRules.map(r => ({
        name: r.config.name,
        url: r.config.url,
        method: r.config.method,
        headers: r.config.headers,
        body: r.config.body,
        queryParams: r.config.queryParams,
        extractPath: r.config.extractPath,
        matchPattern: r.config.matchPattern,
        timeoutMs: r.config.timeoutMs,
        validationLogic: r.validationLogic,
        expectedValue: r.expectedValue,
      }));

      const crossCheckResult = await this.crossCheckService.crossCheckWithHttpRules(
        {
          claim: dto.claim,
          context: dto.content,
          keywords: this.extractKeywords(dto.title, dto.content),
        },
        httpRules
      );

      const approved = crossCheckResult.overallStatus === 'verified' && crossCheckResult.confidence >= 0.7;

      return {
        success: true,
        data: {
          storyId: dto.storyId,
          approved,
          confidence: crossCheckResult.confidence,
          status: approved ? 'approved' : 'pending-review',
          reason: approved ? 'Custom rules validation passed' : 'Insufficient validation score',
          rulesChecked: dto.httpRules.length,
          checks: {
            crossCheck: crossCheckResult,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Process with rules failed: ${(error as Error).message}`);
      return {
        success: false,
        data: {
          storyId: dto.storyId,
          approved: false,
          confidence: 0,
          status: 'pending-review',
          reason: `Processing failed: ${(error as Error).message}`,
        },
      };
    }
  }

  @Post('cross-check')
  @ApiOperation({ summary: 'Run cross-check validation only' })
  async runCrossCheck(@Body() dto: { claim: string; context?: string; keywords?: string[] }) {
    this.logger.log(`Running cross-check for claim: ${dto.claim.substring(0, 50)}...`);

    try {
      const result = await this.crossCheckService.crossCheck({
        claim: dto.claim,
        context: dto.context,
        keywords: dto.keywords,
      });

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Cross-check failed: ${(error as Error).message}`);
      return {
        success: false,
        data: {
          overallStatus: 'unverified',
          confidence: 0,
          sourcesChecked: [],
          results: [],
          consensus: 'Error running cross-check',
          discrepancies: [(error as Error).message],
          recommendations: ['Check API configuration and try again'],
        },
      };
    }
  }

  @Get('validators')
  @ApiOperation({ summary: 'List available validators' })
  async getValidators() {
    const configs = this.crossCheckService.getValidatorConfigs();

    return {
      success: true,
      data: configs.map(config => ({
        name: config.name,
        enabled: config.enabled,
        weight: config.weight,
        description: this.getValidatorDescription(config.name),
      })),
    };
  }

  @Post('workflows')
  @ApiOperation({ summary: 'Create custom workflow' })
  async createWorkflow(@Body() dto: CreateWorkflowDto) {
    this.logger.log(`Creating workflow: ${dto.name}`);

    return {
      success: true,
      data: {
        workflowId: `wf-${Date.now()}`,
        name: dto.name,
        status: 'created',
        nodes: dto.nodes.length,
      },
    };
  }

  @Get('workflows')
  @ApiOperation({ summary: 'List workflows' })
  async listWorkflows() {
    return {
      success: true,
      data: [
        {
          id: 'wf-default',
          name: 'Default Approval',
          description: 'Standard cross-check validation',
          enabled: true,
          nodes: 3,
        },
        {
          id: 'wf-strict',
          name: 'Strict Approval',
          description: 'High-confidence requirements',
          enabled: true,
          nodes: 5,
        },
      ],
    };
  }

  @Post('workflows/:id/execute')
  @ApiOperation({ summary: 'Execute workflow' })
  async executeWorkflow(
    @Param('id') workflowId: string,
    @Body() input: Record<string, unknown>
  ) {
    this.logger.log(`Executing workflow ${workflowId}`);

    return {
      success: true,
      data: {
        executionId: `exec-${Date.now()}`,
        workflowId,
        status: 'running',
        input,
      },
    };
  }

  @Get('workflows/executions/:id')
  @ApiOperation({ summary: 'Get execution status' })
  async getExecutionStatus(@Param('id') executionId: string) {
    return {
      success: true,
      data: {
        executionId,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 2500,
        nodesExecuted: 5,
        output: {},
      },
    };
  }

  @Post('http-check')
  @ApiOperation({ summary: 'Test HTTP endpoint for validation' })
  @ApiBody({ type: HttpCheckRuleDto })
  async testHttpCheck(@Body() dto: HttpCheckRuleDto) {
    this.logger.log(`Testing HTTP check: ${dto.config.name}`);

    try {
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

      const result = await this.httpValidator.testRule(rule);

      return {
        success: true,
        data: {
          name: dto.config.name,
          passed: result.passed,
          responseTime: result.responseTime,
          extractedValue: result.extractedValue,
          matched: result.matched,
        },
      };
    } catch (error) {
      this.logger.error(`HTTP check failed: ${(error as Error).message}`);
      return {
        success: false,
        data: {
          name: dto.config.name,
          passed: false,
          responseTime: 0,
          error: (error as Error).message,
        },
      };
    }
  }

  private extractKeywords(title?: string, content?: string): string[] {
    const text = `${title || ''} ${content || ''}`;
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4);

    return [...new Set(words)].slice(0, 10);
  }

  private getValidatorDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'wikipedia': 'Check against Wikipedia articles',
      'google-factcheck': 'Check Google Fact Check database',
      'newsapi': 'Check news coverage',
      'http-validator': 'Custom HTTP endpoint checks',
    };
    return descriptions[name] || 'Unknown validator';
  }
}
