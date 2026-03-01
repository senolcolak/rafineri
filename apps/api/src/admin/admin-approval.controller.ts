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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiBody } from '@nestjs/swagger';
import { AdminGuard } from '@/common/guards/admin.guard';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { UseInterceptors } from '@nestjs/common';

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
@Controller('v1/admin/approval')
@UseGuards(AdminGuard)
@UseInterceptors(TransformInterceptor)
export class AdminApprovalController {
  
  @Post('submit')
  @ApiOperation({ summary: 'Submit story for approval workflow' })
  @ApiBody({ type: SubmitApprovalDto })
  async submitForApproval(@Body() dto: SubmitApprovalDto) {
    // Implementation would call ApprovalWorkflowService
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
    // Implementation would call ApprovalWorkflowService.processApproval
    return {
      success: true,
      data: {
        storyId: dto.storyId,
        approved: true,
        confidence: 0.85,
        status: 'approved',
        reason: 'Cross-check verified + AI scoring positive',
        checks: {
          crossCheck: {
            overallStatus: 'verified',
            confidence: 0.82,
            sourcesChecked: ['wikipedia', 'google-factcheck', 'newsapi'],
          },
          aiScore: {
            label: 'verified',
            confidence: 0.88,
          },
        },
      },
    };
  }

  @Post('process-with-rules')
  @ApiOperation({ summary: 'Process with custom HTTP validation rules' })
  @ApiBody({ type: ProcessWithRulesDto })
  async processWithRules(@Body() dto: ProcessWithRulesDto) {
    // Implementation would call ApprovalWorkflowService.processWithHttpRules
    return {
      success: true,
      data: {
        storyId: dto.storyId,
        approved: true,
        confidence: 0.78,
        status: 'approved',
        reason: 'Custom HTTP rules passed',
        rulesChecked: dto.httpRules.length,
        checks: {
          crossCheck: {
            overallStatus: 'verified',
            confidence: 0.78,
          },
        },
      },
    };
  }

  @Post('cross-check')
  @ApiOperation({ summary: 'Run cross-check validation only' })
  async runCrossCheck(@Body() dto: { claim: string; context?: string; keywords?: string[] }) {
    // Implementation would call CrossCheckService
    return {
      success: true,
      data: {
        overallStatus: 'verified',
        confidence: 0.75,
        sourcesChecked: ['wikipedia', 'google-factcheck', 'newsapi'],
        results: [
          {
            source: 'wikipedia',
            status: 'verified',
            confidence: 0.8,
            evidence: [],
          },
          {
            source: 'google-factcheck',
            status: 'verified',
            confidence: 0.7,
            evidence: [],
          },
          {
            source: 'newsapi',
            status: 'unverified',
            confidence: 0.4,
            evidence: [],
          },
        ],
        consensus: 'Moderate support for verification',
        discrepancies: [],
        recommendations: [],
      },
    };
  }

  @Get('validators')
  @ApiOperation({ summary: 'List available validators' })
  async getValidators() {
    return {
      success: true,
      data: [
        {
          name: 'wikipedia',
          enabled: true,
          weight: 0.3,
          description: 'Check against Wikipedia articles',
        },
        {
          name: 'google-factcheck',
          enabled: true,
          weight: 0.4,
          description: 'Check Google Fact Check database',
        },
        {
          name: 'newsapi',
          enabled: true,
          weight: 0.2,
          description: 'Check news coverage',
        },
        {
          name: 'http-validator',
          enabled: true,
          weight: 0.1,
          description: 'Custom HTTP endpoint checks',
        },
      ],
    };
  }

  // Workflow Management Endpoints

  @Post('workflows')
  @ApiOperation({ summary: 'Create custom workflow' })
  async createWorkflow(@Body() dto: CreateWorkflowDto) {
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
          description: 'Standard 3-step approval process',
          enabled: true,
          nodes: 5,
        },
        {
          id: 'wf-strict',
          name: 'Strict Approval',
          description: 'High-confidence requirements',
          enabled: true,
          nodes: 7,
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
  async testHttpCheck(@Body() dto: HttpCheckRuleDto) {
    return {
      success: true,
      data: {
        name: dto.config.name,
        passed: true,
        responseTime: 120,
        extractedValue: 'Sample result',
        matched: true,
      },
    };
  }
}
