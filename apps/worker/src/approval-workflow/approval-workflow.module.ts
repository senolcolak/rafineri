/**
 * Approval Workflow Module
 * 
 * Multi-step approval system for truth verification.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { CrossCheckModule } from '../cross-check/cross-check.module';
import { AutomationModule } from '../automation/automation.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    CrossCheckModule,
    AutomationModule,
    AiModule,
    BullModule.registerQueue({
      name: 'approval',
    }),
  ],
  providers: [ApprovalWorkflowService],
  exports: [ApprovalWorkflowService],
})
export class ApprovalWorkflowModule {}
