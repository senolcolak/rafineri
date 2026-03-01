/**
 * Approval Workflow Service
 * 
 * Multi-step approval system for truth verification:
 * 1. Automated cross-check validation
 * 2. AI-based scoring
 * 3. Manual review (if needed)
 * 4. Final approval/rejection
 * 
 * Integrates CrossCheckService with AutomationEngine.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CrossCheckService } from '../cross-check/cross-check.service';
import { HttpCheckRule } from '../cross-check/http.validator';
import { AutomationEngineService } from '../automation/automation-engine.service';
import { ScoringService as AiScoringService } from '../ai/scoring.service';
import {
  ApprovalWorkflowConfig,
  ApprovalRequest,
  Workflow,
  WorkflowExecution,
} from '../automation/automation.types';
import {
  CrossCheckInput,
  CrossCheckAggregate,
} from '../cross-check/cross-check.types';

export interface StoryApprovalInput {
  storyId: string;
  title: string;
  content?: string;
  claim: string;
  sources?: string[];
  metadata?: Record<string, unknown>;
}

export interface ApprovalResult {
  approved: boolean;
  confidence: number;
  status: 'approved' | 'rejected' | 'escalated' | 'pending-review';
  reason: string;
  checks: {
    crossCheck?: CrossCheckAggregate;
    aiScore?: { label: string; confidence: number; summary: string; reasons: string[] };
    automation?: WorkflowExecution;
  };
  nextSteps?: string[];
}

@Injectable()
export class ApprovalWorkflowService {
  private readonly logger = new Logger(ApprovalWorkflowService.name);

  constructor(
    private readonly crossCheckService: CrossCheckService,
    private readonly automationEngine: AutomationEngineService,
    private readonly aiScoringService: AiScoringService,
    @InjectQueue('approval') private readonly approvalQueue: Queue,
  ) {}

  /**
   * Submit a story for approval workflow
   */
  async submitForApproval(input: StoryApprovalInput): Promise<ApprovalRequest> {
    this.logger.log(`Submitting story ${input.storyId} for approval`);

    const request: ApprovalRequest = {
      id: this.generateId(),
      workflowId: 'default-approval',
      storyId: input.storyId,
      claim: input.claim,
      status: 'pending',
      currentStep: 0,
      stepResults: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        title: input.title,
        content: input.content,
        sources: input.sources,
        ...input.metadata,
      },
    };

    // Queue for processing
    await this.approvalQueue.add('process-approval', {
      requestId: request.id,
      input,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    return request;
  }

  /**
   * Process approval request through all steps
   */
  async processApproval(
    input: StoryApprovalInput,
    config?: ApprovalWorkflowConfig
  ): Promise<ApprovalResult> {
    this.logger.log(`Processing approval for story ${input.storyId}`);

    const defaultConfig: ApprovalWorkflowConfig = {
      steps: [
        {
          id: 'cross-check',
          name: 'Cross-Check Validation',
          type: 'automated',
          validators: ['wikipedia', 'google-factcheck', 'newsapi'],
          minConfidence: 0.6,
        },
        {
          id: 'ai-scoring',
          name: 'AI Scoring',
          type: 'automated',
          minConfidence: 0.7,
        },
        {
          id: 'automation',
          name: 'Custom Automation',
          type: 'automated',
        },
      ],
      consensusRequired: true,
      fallbackAction: 'manual-review',
    };

    const workflowConfig = config || defaultConfig;
    const result: ApprovalResult = {
      approved: false,
      confidence: 0,
      status: 'pending-review',
      reason: '',
      checks: {},
      nextSteps: [],
    };

    // Step 1: Cross-Check Validation
    try {
      const crossCheckInput: CrossCheckInput = {
        claim: input.claim,
        context: input.content,
        keywords: this.extractKeywords(input.title, input.content),
        existingSources: input.sources,
      };

      const crossCheckResult = await this.crossCheckService.crossCheck(crossCheckInput);
      result.checks.crossCheck = crossCheckResult;

      const crossCheckStep = workflowConfig.steps.find(s => s.id === 'cross-check');
      if (crossCheckStep?.minConfidence && crossCheckResult.confidence < crossCheckStep.minConfidence) {
        if (crossCheckResult.overallStatus === 'contradicted') {
          result.status = 'rejected';
          result.reason = `Cross-check found contradictions (${crossCheckResult.consensus})`;
          result.confidence = 1 - crossCheckResult.confidence;
          return result;
        }
      }
    } catch (error) {
      this.logger.error(`Cross-check failed: ${error.message}`);
    }

    // Step 2: AI Scoring
    try {
      const aiResult = await this.aiScoringService.scoreStory({
        title: input.title,
        content: input.content,
        source: input.sources?.[0] || 'unknown',
        claims: [input.claim],
      });

      result.checks.aiScore = aiResult;

      const aiStep = workflowConfig.steps.find(s => s.id === 'ai-scoring');
      if (aiStep?.minConfidence && aiResult.confidence < aiStep.minConfidence) {
        if (aiResult.label === 'contested' || aiResult.label === 'unverified') {
          result.status = 'rejected';
          result.reason = `AI scoring indicates ${aiResult.label} (confidence: ${aiResult.confidence})`;
          result.confidence = 1 - aiResult.confidence;
          return result;
        }
      }
    } catch (error) {
      this.logger.error(`AI scoring failed: ${error.message}`);
    }

    // Step 3: Custom Automation (if configured)
    try {
      const automationResult = await this.runApprovalAutomation(input);
      if (automationResult) {
        result.checks.automation = automationResult;
      }
    } catch (error) {
      this.logger.error(`Automation failed: ${error.message}`);
    }

    // Aggregate results and make decision
    return this.makeApprovalDecision(result, workflowConfig);
  }

  /**
   * Run approval with custom HTTP rules
   */
  async processWithHttpRules(
    input: StoryApprovalInput,
    httpRules: HttpCheckRule[]
  ): Promise<ApprovalResult> {
    this.logger.log(`Processing approval with custom HTTP rules for story ${input.storyId}`);

    const crossCheckInput: CrossCheckInput = {
      claim: input.claim,
      context: input.content,
      keywords: this.extractKeywords(input.title, input.content),
    };

    const crossCheckResult = await this.crossCheckService.crossCheckWithHttpRules(
      crossCheckInput,
      httpRules
    );

    const result: ApprovalResult = {
      approved: false,
      confidence: 0,
      status: 'pending-review',
      reason: '',
      checks: {
        crossCheck: crossCheckResult,
      },
    };

    // Auto-approve if high confidence
    if (crossCheckResult.overallStatus === 'verified' && crossCheckResult.confidence >= 0.8) {
      result.approved = true;
      result.status = 'approved';
      result.confidence = crossCheckResult.confidence;
      result.reason = 'High confidence cross-check verification';
    }
    // Auto-reject if contradicted
    else if (crossCheckResult.overallStatus === 'contradicted' && crossCheckResult.confidence >= 0.7) {
      result.approved = false;
      result.status = 'rejected';
      result.confidence = crossCheckResult.confidence;
      result.reason = 'Cross-check found contradictions';
    }
    // Escalate if disputed
    else if (crossCheckResult.overallStatus === 'disputed') {
      result.status = 'escalated';
      result.reason = 'Conflicting verification results - manual review required';
      result.nextSteps = ['manual-review', 'expert-verification'];
    }
    // Manual review for low confidence
    else {
      result.status = 'pending-review';
      result.reason = 'Insufficient confidence for auto-approval';
      result.nextSteps = ['manual-review'];
    }

    return result;
  }

  /**
   * Create and run a custom approval workflow
   */
  async runCustomWorkflow(
    workflow: Workflow,
    input: Record<string, unknown>,
    secrets?: Record<string, string>
  ): Promise<WorkflowExecution> {
    return this.automationEngine.executeWorkflow(workflow, input, secrets);
  }

  private async runApprovalAutomation(
    input: StoryApprovalInput
  ): Promise<WorkflowExecution | null> {
    // Default approval automation workflow
    const workflow: Workflow = {
      id: 'default-approval-flow',
      name: 'Default Approval Automation',
      description: 'Basic approval checks',
      nodes: [
        {
          id: 'trigger',
          type: 'trigger',
          name: 'Start',
          config: {},
          position: { x: 0, y: 0 },
        },
        {
          id: 'check-sources',
          type: 'condition',
          name: 'Check Sources',
          config: {
            conditions: [
              { field: 'sources', operator: 'exists', value: true },
            ],
            logic: 'AND',
          },
          position: { x: 200, y: 0 },
        },
        {
          id: 'aggregate-data',
          type: 'aggregate',
          name: 'Aggregate Data',
          config: {},
          position: { x: 400, y: 0 },
        },
      ],
      connections: [
        { from: 'trigger', to: 'check-sources' },
        { from: 'check-sources', to: 'aggregate-data', condition: '$.data.sources' },
      ],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      trigger: { type: 'manual', config: {} },
    };

    try {
      return await this.automationEngine.executeWorkflow(workflow, {
        storyId: input.storyId,
        title: input.title,
        claim: input.claim,
        sources: input.sources,
      });
    } catch (error) {
      this.logger.error(`Approval automation failed: ${error.message}`);
      return null;
    }
  }

  private makeApprovalDecision(
    result: ApprovalResult,
    config: ApprovalWorkflowConfig
  ): ApprovalResult {
    const checks = result.checks;
    let totalConfidence = 0;
    let checkCount = 0;

    // Aggregate confidence from all checks
    if (checks.crossCheck) {
      totalConfidence += checks.crossCheck.confidence;
      checkCount++;
    }
    if (checks.aiScore) {
      const aiConfidence = checks.aiScore.confidence;
      totalConfidence += aiConfidence;
      checkCount++;
    }
    if (checks.automation) {
      totalConfidence += 0.5; // Automation contributes base confidence
      checkCount++;
    }

    const avgConfidence = checkCount > 0 ? totalConfidence / checkCount : 0;
    result.confidence = avgConfidence;

    // Decision logic
    const crossCheckStatus = checks.crossCheck?.overallStatus;
    const aiLabel = checks.aiScore?.label;

    // Auto-approve criteria
    if (
      crossCheckStatus === 'verified' &&
      (aiLabel === 'verified' || aiLabel === 'likely') &&
      avgConfidence >= 0.75
    ) {
      result.approved = true;
      result.status = 'approved';
      result.reason = `Auto-approved: Cross-check (${crossCheckStatus}), AI (${aiLabel}), Confidence (${avgConfidence.toFixed(2)})`;
      return result;
    }

    // Auto-reject criteria
    if (
      crossCheckStatus === 'contradicted' ||
      aiLabel === 'contested'
    ) {
      result.approved = false;
      result.status = 'rejected';
      result.reason = `Auto-rejected: Cross-check (${crossCheckStatus}), AI (${aiLabel})`;
      return result;
    }

    // Escalate if disputed
    if (crossCheckStatus === 'disputed') {
      result.status = 'escalated';
      result.reason = 'Conflicting verification results';
      result.nextSteps = ['manual-review', 'expert-verification'];
      return result;
    }

    // Default to manual review
    result.status = 'pending-review';
    result.reason = 'Requires manual review';
    result.nextSteps = ['manual-review'];

    return result;
  }

  private extractKeywords(title?: string, content?: string): string[] {
    const text = `${title || ''} ${content || ''}`;
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4)
      .filter(w => !this.isStopWord(w));
    
    return [...new Set(words)].slice(0, 10);
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'about', 'after', 'again', 'being', 'could', 'does', 'doing',
      'having', 'here', 'just', 'more', 'most', 'only', 'other',
      'over', 'same', 'should', 'some', 'such', 'than', 'that',
      'their', 'them', 'then', 'there', 'these', 'they', 'this',
      'those', 'through', 'under', 'very', 'what', 'when', 'where',
      'which', 'while', 'with', 'would', 'about', 'above',
    ]);
    return stopWords.has(word);
  }

  private generateId(): string {
    return `apr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
