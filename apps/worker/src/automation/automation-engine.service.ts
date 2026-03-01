/**
 * Automation Engine Service
 * 
 * Executes n8n-like workflows with support for:
 * - HTTP requests (curl-like)
 * - JavaScript/JSONata transformations
 * - Conditional branching
 * - Bash command execution (sandboxed)
 * - Data aggregation
 * 
 * Similar to n8n but focused on truth verification workflows.
 */

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as vm from 'vm';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  Workflow,
  WorkflowNode,
  WorkflowConnection,
  WorkflowExecution,
  NodeExecution,
  WorkflowContext,
  HttpRequestConfig,
  ConditionConfig,
  TransformConfig,
  ScriptConfig,
  BashConfig,
} from './automation.types';

const execAsync = promisify(exec);

@Injectable()
export class AutomationEngineService {
  private readonly logger = new Logger(AutomationEngineService.name);
  private readonly activeExecutions = new Map<string, AbortController>();

  constructor(private readonly httpService: HttpService) {}

  /**
   * Execute a workflow with given input
   */
  async executeWorkflow(
    workflow: Workflow,
    input: Record<string, unknown>,
    secrets: Record<string, string> = {}
  ): Promise<WorkflowExecution> {
    const executionId = this.generateId();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'running',
      startedAt: new Date(),
      input,
      nodeExecutions: [],
    };

    const abortController = new AbortController();
    this.activeExecutions.set(executionId, abortController);

    const context: WorkflowContext = {
      input,
      data: { ...input },
      secrets,
      execution: {
        id: executionId,
        startedAt: execution.startedAt,
      },
      nodes: {},
    };

    try {
      // Find trigger node
      const triggerNode = workflow.nodes.find(n => n.type === 'trigger');
      if (!triggerNode) {
        throw new Error('Workflow must have a trigger node');
      }

      // Execute starting from trigger
      await this.executeNodeChain(
        workflow,
        triggerNode,
        context,
        execution,
        abortController.signal
      );

      execution.status = 'completed';
      execution.output = context.data;
      execution.completedAt = new Date();

    } catch (error) {
      this.logger.error(`Workflow execution failed: ${error.message}`);
      execution.status = 'failed';
      execution.error = error.message;
      execution.completedAt = new Date();
    } finally {
      this.activeExecutions.delete(executionId);
    }

    return execution;
  }

  /**
   * Cancel a running workflow execution
   */
  cancelExecution(executionId: string): boolean {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  private async executeNodeChain(
    workflow: Workflow,
    currentNode: WorkflowNode,
    context: WorkflowContext,
    execution: WorkflowExecution,
    signal: AbortSignal
  ): Promise<void> {
    if (signal.aborted) {
      throw new Error('Execution cancelled');
    }

    // Execute current node
    const nodeExecution = await this.executeNode(currentNode, context, signal);
    execution.nodeExecutions.push(nodeExecution);
    context.nodes[currentNode.id] = nodeExecution;

    if (nodeExecution.status === 'failed') {
      throw new Error(`Node ${currentNode.name} failed: ${nodeExecution.error}`);
    }

    // Find next nodes based on connections
    const connections = workflow.connections.filter(c => c.from === currentNode.id);
    
    for (const connection of connections) {
      // Check condition if present
      if (connection.condition) {
        const shouldProceed = this.evaluateCondition(connection.condition, context);
        if (!shouldProceed) {
          continue;
        }
      }

      const nextNode = workflow.nodes.find(n => n.id === connection.to);
      if (nextNode) {
        await this.executeNodeChain(workflow, nextNode, context, execution, signal);
      }
    }
  }

  private async executeNode(
    node: WorkflowNode,
    context: WorkflowContext,
    signal: AbortSignal
  ): Promise<NodeExecution> {
    const nodeExecution: NodeExecution = {
      nodeId: node.id,
      nodeName: node.name,
      status: 'running',
      startedAt: new Date(),
      input: context.data,
      logs: [],
    };

    try {
      switch (node.type) {
        case 'trigger':
          // Trigger just passes through
          nodeExecution.output = context.data;
          break;

        case 'http-request':
          nodeExecution.output = await this.executeHttpRequest(
            node.config as unknown as HttpRequestConfig,
            context,
            signal
          );
          break;

        case 'condition':
          const conditionResult = this.evaluateNodeCondition(
            node.config as unknown as ConditionConfig,
            context
          );
          nodeExecution.output = { conditionMet: conditionResult };
          break;

        case 'transform':
          nodeExecution.output = await this.executeTransform(
            node.config as unknown as TransformConfig,
            context
          );
          break;

        case 'script':
          nodeExecution.output = await this.executeScript(
            node.config as unknown as ScriptConfig,
            context,
            signal
          );
          break;

        case 'bash':
          nodeExecution.output = await this.executeBash(
            node.config as unknown as BashConfig,
            context,
            signal
          );
          break;

        case 'aggregate':
          nodeExecution.output = this.executeAggregate(context);
          break;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      // Update context data with node output
      context.data = { ...context.data, ...nodeExecution.output };
      nodeExecution.status = 'completed';
      nodeExecution.completedAt = new Date();

    } catch (error) {
      nodeExecution.status = 'failed';
      nodeExecution.error = error.message;
      nodeExecution.logs.push(`Error: ${error.message}`);
    }

    return nodeExecution;
  }

  private async executeHttpRequest(
    config: HttpRequestConfig,
    context: WorkflowContext,
    signal: AbortSignal
  ): Promise<Record<string, unknown>> {
    // Replace template variables
    const url = this.replaceTemplateVars(config.url, context);
    const headers: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(config.headers || {})) {
      headers[key] = this.replaceTemplateVars(value, context);
    }

    // Handle authentication
    if (config.authentication) {
      switch (config.authentication.type) {
        case 'bearer':
          const token = this.replaceTemplateVars(
            config.authentication.value || '',
            context,
            true
          );
          headers['Authorization'] = `Bearer ${token}`;
          break;
        case 'basic':
          const username = this.replaceTemplateVars(
            config.authentication.username || '',
            context,
            true
          );
          const password = this.replaceTemplateVars(
            config.authentication.password || '',
            context,
            true
          );
          headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
          break;
        case 'api-key':
          const apiKey = this.replaceTemplateVars(
            config.authentication.value || '',
            context,
            true
          );
          headers[config.authentication.headerName || 'X-API-Key'] = apiKey;
          break;
      }
    }

    // Build query params
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(config.queryParams || {})) {
      params.set(key, this.replaceTemplateVars(value, context));
    }

    // Build body
    let body: unknown = undefined;
    if (config.body) {
      body = this.replaceTemplateVarsInObject(config.body, context);
    }

    // Make request
    const response = await firstValueFrom(
      this.httpService.request({
        method: config.method,
        url: url + (params.toString() ? `?${params.toString()}` : ''),
        headers,
        data: body,
        timeout: config.timeoutMs || 30000,
        signal,
      })
    );

    // Extract response data
    let responseData = response.data;
    if (config.responsePath) {
      responseData = this.extractValueByPath(responseData, config.responsePath);
    }

    return {
      statusCode: response.status,
      data: responseData,
      headers: response.headers,
    };
  }

  private evaluateNodeCondition(
    config: ConditionConfig,
    context: WorkflowContext
  ): boolean {
    const results = config.conditions.map(condition => {
      const fieldValue = this.extractValueByPath(context.data, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not-equals':
          return fieldValue !== condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'greater-than':
          return Number(fieldValue) > Number(condition.value);
        case 'less-than':
          return Number(fieldValue) < Number(condition.value);
        case 'exists':
          return fieldValue !== undefined && fieldValue !== null;
        case 'matches':
          const regex = new RegExp(String(condition.value), 'i');
          return regex.test(String(fieldValue));
        case 'starts-with':
          return String(fieldValue).startsWith(String(condition.value));
        case 'ends-with':
          return String(fieldValue).endsWith(String(condition.value));
        default:
          return false;
      }
    });

    return config.logic === 'AND' 
      ? results.every(r => r)
      : results.some(r => r);
  }

  private async executeTransform(
    config: TransformConfig,
    context: WorkflowContext
  ): Promise<Record<string, unknown>> {
    let result = { ...context.data };

    for (const operation of config.operations) {
      switch (operation.type) {
        case 'set':
          const path = operation.config.path as string;
          const value = operation.config.value;
          this.setValueByPath(result, path, value);
          break;

        case 'extract':
          const fromPath = operation.config.from as string;
          const toPath = operation.config.to as string;
          const extractedValue = this.extractValueByPath(result, fromPath);
          this.setValueByPath(result, toPath, extractedValue);
          break;

        case 'map':
          const arrayPath = operation.config.array as string;
          const mapFn = operation.config.fn as string;
          const arr = this.extractValueByPath(result, arrayPath) as unknown[];
          if (Array.isArray(arr)) {
            result = { ...result, [arrayPath]: arr.map(item => this.applyMapFn(item, mapFn)) };
          }
          break;

        case 'format':
          const formatTemplate = operation.config.template as string;
          const formatTarget = operation.config.target as string;
          this.setValueByPath(result, formatTarget, this.replaceTemplateVars(formatTemplate, { data: result } as WorkflowContext));
          break;

        case 'merge':
          const mergeSource = operation.config.source as string;
          const mergeTarget = operation.config.target as string;
          const sourceValue = this.extractValueByPath(result, mergeSource);
          const targetValue = this.extractValueByPath(result, mergeTarget);
          if (typeof sourceValue === 'object' && typeof targetValue === 'object') {
            this.setValueByPath(result, mergeTarget, { ...targetValue, ...sourceValue });
          }
          break;
      }
    }

    return result;
  }

  private async executeScript(
    config: ScriptConfig,
    context: WorkflowContext,
    signal: AbortSignal
  ): Promise<Record<string, unknown>> {
    const timeout = config.timeoutMs || 5000;
    
    if (config.language === 'javascript') {
      // Sandboxed JavaScript execution
      const sandbox = {
        $input: context.input,
        $data: context.data,
        $secrets: context.secrets,
        console: {
          log: (...args: unknown[]) => {
            this.logger.log(`[Script ${config.code.substring(0, 50)}...]`, args);
          },
        },
      };

      const script = new vm.Script(`
        (async () => {
          ${config.code}
        })()
      `);

      const result = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Script execution timeout after ${timeout}ms`));
        }, timeout);

        script.runInNewContext(sandbox, { timeout })
          .then((res: unknown) => {
            clearTimeout(timeoutId);
            resolve(res);
          })
          .catch((err: Error) => {
            clearTimeout(timeoutId);
            reject(err);
          });
      });

      return result as Record<string, unknown>;
    }

    throw new Error(`Unsupported script language: ${config.language}`);
  }

  private async executeBash(
    config: BashConfig,
    context: WorkflowContext,
    signal: AbortSignal
  ): Promise<Record<string, unknown>> {
    if (!config.allowUnsafe) {
      throw new Error('Bash execution not allowed (allowUnsafe=false)');
    }

    // Replace template variables
    let command = this.replaceTemplateVars(config.command, context);
    
    // Security: sanitize dangerous commands
    const dangerousPatterns = [/rm\s+-rf\s+\//, />\s*\/dev\/null/, /curl\s+.*\|\s*sh/];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error('Potentially dangerous command detected');
      }
    }

    const options: { cwd?: string; env?: Record<string, string>; timeout?: number; signal?: AbortSignal } = {
      timeout: config.timeoutMs || 30000,
      signal,
    };

    if (config.workingDirectory) {
      options.cwd = config.workingDirectory;
    }

    if (config.envVars) {
      options.env = { ...process.env };
      for (const [key, value] of Object.entries(config.envVars)) {
        options.env[key] = this.replaceTemplateVars(value, context);
      }
    }

    const { stdout, stderr } = await execAsync(command, options);

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    };
  }

  private executeAggregate(context: WorkflowContext): Record<string, unknown> {
    // Aggregate data from multiple node outputs
    const aggregated: Record<string, unknown> = {};
    
    for (const [nodeId, execution] of Object.entries(context.nodes)) {
      if (execution.output) {
        aggregated[nodeId] = execution.output;
      }
    }

    return {
      aggregated,
      allOutputs: context.nodes,
    };
  }

  private evaluateCondition(condition: string, context: WorkflowContext): boolean {
    try {
      // Simple condition evaluation (e.g., "$.data.status === 'verified'")
      const replaced = this.replaceTemplateVars(condition, context);
      // eslint-disable-next-line no-eval
      return eval(replaced);
    } catch {
      return false;
    }
  }

  private replaceTemplateVars(template: string, context: WorkflowContext, isSecret = false): string {
    return template
      .replace(/\{\{\s*\$input\.([\w.]+)\s*\}\}/g, (_, path) => {
        const value = this.extractValueByPath(context.input, path);
        return isSecret ? String(value) : JSON.stringify(value);
      })
      .replace(/\{\{\s*\$data\.([\w.]+)\s*\}\}/g, (_, path) => {
        const value = this.extractValueByPath(context.data, path);
        return isSecret ? String(value) : JSON.stringify(value);
      })
      .replace(/\{\{\s*\$secrets\.([\w.]+)\s*\}\}/g, (_, key) => {
        return context.secrets[key] || '';
      })
      .replace(/\{\{\s*now\(\)\s*\}\}/g, () => new Date().toISOString())
      .replace(/\{\{\s*random\(\)\s*\}\}/g, () => Math.random().toString(36).substring(2));
  }

  private replaceTemplateVarsInObject(obj: unknown, context: WorkflowContext): unknown {
    if (typeof obj === 'string') {
      const replaced = this.replaceTemplateVars(obj, context);
      // Try to parse as JSON if it looks like JSON
      if (replaced.startsWith('{') || replaced.startsWith('[')) {
        try {
          return JSON.parse(replaced);
        } catch {
          return replaced;
        }
      }
      return replaced;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.replaceTemplateVarsInObject(item, context));
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replaceTemplateVarsInObject(value, context);
      }
      return result;
    }
    return obj;
  }

  private extractValueByPath(obj: unknown, path: string): unknown {
    if (!path) return obj;
    
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        current = current[parseInt(part)];
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  private setValueByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: any = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }

  private applyMapFn(item: unknown, fn: string): unknown {
    try {
      // Simple function evaluation (e.g., "x => x.name")
      const func = new Function('x', `return (${fn})(x)`);
      return func(item);
    } catch {
      return item;
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
