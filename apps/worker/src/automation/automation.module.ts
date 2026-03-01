/**
 * Automation Module
 * 
 * n8n-like workflow automation system.
 */

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { AutomationEngineService } from './automation-engine.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
    BullModule.registerQueue({
      name: 'automation',
    }),
  ],
  providers: [AutomationEngineService],
  exports: [AutomationEngineService],
})
export class AutomationModule {}
