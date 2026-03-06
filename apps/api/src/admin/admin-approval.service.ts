import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import {
  approvalDecisions,
  approvalRequests,
  approvalSteps,
  auditLogs,
  stories,
} from '@/database/schema';

type RequestStatus =
  | 'queued'
  | 'processing'
  | 'awaiting_manual_review'
  | 'approved'
  | 'rejected'
  | 'failed'
  | 'cancelled';

type ManualDecision = 'approved' | 'rejected';

@Injectable()
export class AdminApprovalService implements OnModuleDestroy {
  private queue: Queue<{ requestId: number }> | null = null;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: Database,
    private readonly configService: ConfigService,
  ) {}

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }

  async submitRequest(input: {
    storyId: number;
    claim: string;
    title?: string;
    content?: string;
    sources?: string[];
    idempotencyKey?: string;
    submittedBy?: number;
    priority?: number;
  }) {
    const [story] = await this.db
      .select({ id: stories.id })
      .from(stories)
      .where(eq(stories.id, input.storyId))
      .limit(1);
    if (!story) {
      throw new NotFoundException(`Story not found: ${input.storyId}`);
    }

    const idempotencyKey =
      input.idempotencyKey ||
      `${input.storyId}:${Buffer.from(input.claim).toString('base64url').slice(0, 20)}`;

    const now = new Date();
    const [request] = await this.db
      .insert(approvalRequests)
      .values({
        storyId: input.storyId,
        status: 'queued',
        priority: input.priority || 0,
        idempotencyKey,
        submittedBy: input.submittedBy,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: approvalRequests.idempotencyKey,
        set: {
          updatedAt: now,
        },
      })
      .returning({
        id: approvalRequests.id,
        status: approvalRequests.status,
      });

    await this.db.insert(approvalSteps).values({
      requestId: request.id,
      stepType: 'cross_check',
      status: 'pending',
      inputJson: {
        claim: input.claim,
        title: input.title,
        content: input.content,
        sources: input.sources,
      },
    });

    await this.db.insert(auditLogs).values({
      adminUserId: input.submittedBy,
      action: 'approval_request.submitted',
      entityType: 'approval_request',
      entityId: String(request.id),
      metadata: {
        storyId: input.storyId,
        idempotencyKey,
      },
    });

    await this.getQueue().add(
      'process-approval',
      { requestId: request.id },
      {
        jobId: `approval:${request.id}`,
      },
    );

    return {
      requestId: String(request.id),
      status: request.status,
      message: 'Story submitted for approval',
    };
  }

  async listRequests(params: {
    status?: RequestStatus;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const where = params.status ? eq(approvalRequests.status, params.status) : undefined;
    const rows = await this.db
      .select({
        id: approvalRequests.id,
        storyId: approvalRequests.storyId,
        status: approvalRequests.status,
        priority: approvalRequests.priority,
        finalConfidence: approvalRequests.finalConfidence,
        finalReason: approvalRequests.finalReason,
        createdAt: approvalRequests.createdAt,
        updatedAt: approvalRequests.updatedAt,
        completedAt: approvalRequests.completedAt,
      })
      .from(approvalRequests)
      .where(where)
      .orderBy(desc(approvalRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((row) => ({
      id: String(row.id),
      storyId: String(row.storyId),
      status: row.status,
      priority: row.priority,
      finalConfidence: row.finalConfidence,
      finalReason: row.finalReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      completedAt: row.completedAt?.toISOString() || null,
    }));

    return {
      items,
      page,
      limit,
    };
  }

  async getRequest(id: number) {
    const [request] = await this.db
      .select({
        id: approvalRequests.id,
        storyId: approvalRequests.storyId,
        status: approvalRequests.status,
        priority: approvalRequests.priority,
        finalConfidence: approvalRequests.finalConfidence,
        finalReason: approvalRequests.finalReason,
        createdAt: approvalRequests.createdAt,
        updatedAt: approvalRequests.updatedAt,
        startedAt: approvalRequests.startedAt,
        completedAt: approvalRequests.completedAt,
      })
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .limit(1);

    if (!request) {
      throw new NotFoundException(`Approval request not found: ${id}`);
    }

    const steps = await this.db
      .select({
        id: approvalSteps.id,
        stepType: approvalSteps.stepType,
        status: approvalSteps.status,
        inputJson: approvalSteps.inputJson,
        outputJson: approvalSteps.outputJson,
        errorJson: approvalSteps.errorJson,
        startedAt: approvalSteps.startedAt,
        completedAt: approvalSteps.completedAt,
        durationMs: approvalSteps.durationMs,
      })
      .from(approvalSteps)
      .where(eq(approvalSteps.requestId, id))
      .orderBy(approvalSteps.id);

    const decisions = await this.db
      .select({
        id: approvalDecisions.id,
        decision: approvalDecisions.decision,
        reason: approvalDecisions.reason,
        confidence: approvalDecisions.confidence,
        source: approvalDecisions.source,
        createdAt: approvalDecisions.createdAt,
      })
      .from(approvalDecisions)
      .where(eq(approvalDecisions.requestId, id))
      .orderBy(desc(approvalDecisions.createdAt));

    return {
      id: String(request.id),
      storyId: String(request.storyId),
      status: request.status,
      priority: request.priority,
      finalConfidence: request.finalConfidence,
      finalReason: request.finalReason,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      startedAt: request.startedAt?.toISOString() || null,
      completedAt: request.completedAt?.toISOString() || null,
      steps: steps.map((step) => ({
        id: String(step.id),
        stepType: step.stepType,
        status: step.status,
        input: step.inputJson,
        output: step.outputJson,
        error: step.errorJson,
        startedAt: step.startedAt?.toISOString() || null,
        completedAt: step.completedAt?.toISOString() || null,
        durationMs: step.durationMs,
      })),
      decisions: decisions.map((decision) => ({
        id: String(decision.id),
        decision: decision.decision,
        reason: decision.reason,
        confidence: decision.confidence,
        source: decision.source,
        createdAt: decision.createdAt.toISOString(),
      })),
    };
  }

  async retryRequest(id: number, requestedBy?: number) {
    const [request] = await this.db
      .select({
        id: approvalRequests.id,
        status: approvalRequests.status,
      })
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .limit(1);
    if (!request) {
      throw new NotFoundException(`Approval request not found: ${id}`);
    }

    if (!['failed', 'cancelled'].includes(request.status)) {
      throw new InternalServerErrorException('Only failed or cancelled requests can be retried');
    }

    await this.db
      .update(approvalRequests)
      .set({
        status: 'queued',
        updatedAt: new Date(),
        completedAt: null,
      })
      .where(eq(approvalRequests.id, id));

    await this.db.insert(auditLogs).values({
      adminUserId: requestedBy,
      action: 'approval_request.retried',
      entityType: 'approval_request',
      entityId: String(id),
      metadata: {},
    });

    await this.getQueue().add('process-approval', { requestId: id }, { jobId: `approval:${id}:retry:${Date.now()}` });

    return {
      id: String(id),
      status: 'queued',
      message: 'Approval request queued for retry',
    };
  }

  async cancelRequest(id: number, requestedBy?: number) {
    const [request] = await this.db
      .select({
        id: approvalRequests.id,
        status: approvalRequests.status,
      })
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .limit(1);
    if (!request) {
      throw new NotFoundException(`Approval request not found: ${id}`);
    }

    if (!['queued', 'processing', 'awaiting_manual_review'].includes(request.status)) {
      throw new InternalServerErrorException('Request cannot be cancelled in current status');
    }

    await this.db
      .update(approvalRequests)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(eq(approvalRequests.id, id));

    await this.db.insert(auditLogs).values({
      adminUserId: requestedBy,
      action: 'approval_request.cancelled',
      entityType: 'approval_request',
      entityId: String(id),
      metadata: {},
    });

    return {
      id: String(id),
      status: 'cancelled',
      message: 'Approval request cancelled',
    };
  }

  async manualDecision(
    id: number,
    input: {
      decision: ManualDecision;
      reason: string;
      confidence: number;
      decidedBy?: number;
    },
  ) {
    const [request] = await this.db
      .select({
        id: approvalRequests.id,
        status: approvalRequests.status,
        storyId: approvalRequests.storyId,
      })
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .limit(1);
    if (!request) {
      throw new NotFoundException(`Approval request not found: ${id}`);
    }

    if (!['awaiting_manual_review', 'processing'].includes(request.status)) {
      throw new InternalServerErrorException('Manual decision can only be applied to in-flight requests');
    }

    const status = input.decision === 'approved' ? 'approved' : 'rejected';
    const now = new Date();
    await this.db
      .update(approvalRequests)
      .set({
        status,
        finalReason: input.reason,
        finalConfidence: input.confidence,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(approvalRequests.id, id));

    await this.db.insert(approvalDecisions).values({
      requestId: id,
      decision: input.decision,
      reason: input.reason,
      confidence: input.confidence,
      decidedBy: input.decidedBy,
      source: 'manual',
      createdAt: now,
    });

    await this.db.insert(approvalSteps).values({
      requestId: id,
      stepType: 'manual_review',
      status: 'passed',
      outputJson: {
        decision: input.decision,
        reason: input.reason,
        confidence: input.confidence,
      },
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      createdAt: now,
    });

    await this.db.insert(auditLogs).values({
      adminUserId: input.decidedBy,
      action: 'approval_request.manual_decision',
      entityType: 'approval_request',
      entityId: String(id),
      metadata: {
        decision: input.decision,
        confidence: input.confidence,
      },
    });

    return {
      id: String(id),
      status,
      message: `Request ${status} by manual review`,
    };
  }

  private getQueue(): Queue<{ requestId: number }> {
    if (!this.queue) {
      this.queue = new Queue('approval', {
        connection: {
          host: this.configService.get<string>('redis.host'),
          port: this.configService.get<number>('redis.port'),
          password: this.configService.get<string>('redis.password'),
          db: this.configService.get<number>('redis.db'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });
    }

    return this.queue;
  }
}
