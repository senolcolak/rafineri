import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { and, desc, eq } from 'drizzle-orm';
import { QUEUE_NAMES } from './queue-definitions.module';
import { ApprovalWorkflowService } from '../approval-workflow/approval-workflow.service';
import { DATABASE_PROVIDER, Database } from '../config/database.module';
import {
  approvalDecisions,
  approvalRequests,
  approvalSteps,
  stories,
} from '../database/schema';

interface ApprovalJobData {
  requestId: number;
}

@Processor(QUEUE_NAMES.APPROVAL, {
  concurrency: 2,
})
export class ApprovalProcessor extends WorkerHost {
  private readonly logger = new Logger(ApprovalProcessor.name);

  constructor(
    private readonly workflowService: ApprovalWorkflowService,
    @Inject(DATABASE_PROVIDER) private readonly db: Database,
  ) {
    super();
  }

  async process(job: Job<ApprovalJobData>): Promise<void> {
    const requestId = Number(job.data.requestId);
    this.logger.log(`Processing approval request ${requestId}`);

    const [request] = await this.db
      .select({
        id: approvalRequests.id,
        storyId: approvalRequests.storyId,
        status: approvalRequests.status,
      })
      .from(approvalRequests)
      .where(eq(approvalRequests.id, requestId))
      .limit(1);

    if (!request) {
      this.logger.warn(`Approval request ${requestId} not found`);
      return;
    }

    if (['approved', 'rejected', 'failed', 'cancelled'].includes(request.status)) {
      this.logger.warn(`Approval request ${requestId} is already terminal (${request.status})`);
      return;
    }

    const [crossCheckStep] = await this.db
      .select({
        id: approvalSteps.id,
        inputJson: approvalSteps.inputJson,
      })
      .from(approvalSteps)
      .where(
        and(
          eq(approvalSteps.requestId, requestId),
          eq(approvalSteps.stepType, 'cross_check'),
        ),
      )
      .orderBy(desc(approvalSteps.id))
      .limit(1);

    if (!crossCheckStep?.inputJson || typeof crossCheckStep.inputJson !== 'object') {
      await this.markFailed(requestId, 'Missing cross-check input payload');
      return;
    }

    const input = crossCheckStep.inputJson as {
      title?: string;
      content?: string;
      claim?: string;
      sources?: string[];
    };
    if (!input.claim) {
      await this.markFailed(requestId, 'Missing claim for approval processing');
      return;
    }

    const startedAt = new Date();
    await this.db
      .update(approvalRequests)
      .set({
        status: 'processing',
        startedAt,
        updatedAt: startedAt,
      })
      .where(eq(approvalRequests.id, requestId));

    await this.db
      .update(approvalSteps)
      .set({
        status: 'running',
        startedAt,
      })
      .where(eq(approvalSteps.id, crossCheckStep.id));

    try {
      const result = await this.workflowService.processApproval({
        storyId: String(request.storyId),
        title: input.title || `Story ${request.storyId}`,
        content: input.content,
        claim: input.claim,
        sources: input.sources,
      });

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      await this.db
        .update(approvalSteps)
        .set({
          status: 'passed',
          completedAt,
          durationMs,
          outputJson: {
            crossCheck: result.checks.crossCheck || null,
            aiScore: result.checks.aiScore || null,
            automation: result.checks.automation || null,
          },
        })
        .where(eq(approvalSteps.id, crossCheckStep.id));

      const status =
        result.status === 'approved'
          ? 'approved'
          : result.status === 'rejected'
            ? 'rejected'
            : 'awaiting_manual_review';

      const decision =
        status === 'approved'
          ? 'approved'
          : status === 'rejected'
            ? 'rejected'
            : 'escalated';

      await this.db.insert(approvalDecisions).values({
        requestId,
        decision,
        reason: result.reason,
        confidence: result.confidence,
        source: 'automated',
      });

      await this.db
        .update(approvalRequests)
        .set({
          status,
          finalConfidence: result.confidence,
          finalReason: result.reason,
          completedAt: status === 'awaiting_manual_review' ? null : completedAt,
          updatedAt: completedAt,
        })
        .where(eq(approvalRequests.id, requestId));

      if (status === 'approved' || status === 'rejected') {
        await this.db
          .update(stories)
          .set({
            label: status === 'approved' ? (result.confidence >= 0.8 ? 'verified' : 'likely') : 'contested',
            confidence: result.confidence,
            updatedAt: completedAt,
          })
          .where(eq(stories.id, request.storyId));
      }
    } catch (error) {
      this.logger.error(`Approval request ${requestId} failed: ${(error as Error).message}`);
      await this.markFailed(requestId, (error as Error).message, crossCheckStep.id);
      throw error;
    }
  }

  private async markFailed(requestId: number, reason: string, stepId?: number) {
    const now = new Date();
    await this.db
      .update(approvalRequests)
      .set({
        status: 'failed',
        finalReason: reason,
        updatedAt: now,
        completedAt: now,
      })
      .where(eq(approvalRequests.id, requestId));

    if (stepId) {
      await this.db
        .update(approvalSteps)
        .set({
          status: 'failed',
          completedAt: now,
          errorJson: { reason },
        })
        .where(eq(approvalSteps.id, stepId));
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ApprovalJobData>) {
    this.logger.debug(`Approval job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ApprovalJobData>, error: Error) {
    this.logger.error(`Approval job ${job?.id} failed: ${error.message}`);
  }
}
