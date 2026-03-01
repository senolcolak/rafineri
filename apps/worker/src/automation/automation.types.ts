/**
 * Automation Engine Types
 * 
 * n8n-like workflow automation system for truth verification.
 * Supports JSON scripting, bash commands, and HTTP requests.
 */

export type WorkflowNodeType = 
  | 'trigger'
  | 'http-request'
  | 'condition'
  | 'transform'
  | 'script'
  | 'bash'
  | 'delay'
  | 'webhook'
  | 'aggregate'
  | 'notify';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowConnection {
  from: string;
  to: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  trigger: {
    type: 'manual' | 'scheduled' | 'webhook' | 'event';
    config: Record<string, unknown>;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  nodeExecutions: NodeExecution[];
  error?: string;
}

export interface NodeExecution {
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: Date;
  completedAt?: Date;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  logs: string[];
}

// Node-specific configurations
export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
  authentication?: {
    type: 'none' | 'bearer' | 'basic' | 'api-key';
    value?: string;
    username?: string;
    password?: string;
    headerName?: string;
  };
  timeoutMs?: number;
  retryCount?: number;
  responsePath?: string;
}

export interface ConditionConfig {
  conditions: Array<{
    field: string;
    operator: 'equals' | 'not-equals' | 'contains' | 'greater-than' | 
              'less-than' | 'exists' | 'matches' | 'starts-with' | 'ends-with';
    value: unknown;
  }>;
  logic: 'AND' | 'OR';
}

export interface TransformConfig {
  operations: Array<{
    type: 'map' | 'filter' | 'reduce' | 'set' | 'extract' | 'format' | 'merge';
    config: Record<string, unknown>;
  }>;
}

export interface ScriptConfig {
  language: 'javascript' | 'jsonata';
  code: string;
  timeoutMs?: number;
}

export interface BashConfig {
  command: string;
  workingDirectory?: string;
  envVars?: Record<string, string>;
  timeoutMs?: number;
  allowUnsafe?: boolean;
}

export interface WebhookConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  authentication?: 'none' | 'token' | 'hmac';
  secret?: string;
}

export interface NotificationConfig {
  channels: Array<{
    type: 'email' | 'slack' | 'discord' | 'webhook';
    config: Record<string, unknown>;
  }>;
  template: string;
  dataMapping: Record<string, string>;
}

// Context passed between nodes
export interface WorkflowContext {
  input: Record<string, unknown>;
  data: Record<string, unknown>;
  secrets: Record<string, string>;
  execution: {
    id: string;
    startedAt: Date;
  };
  nodes: Record<string, NodeExecution>;
}

// Pre-built workflow templates
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: 'verification' | 'ingestion' | 'approval' | 'notification' | 'custom';
  workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>;
}

// Approval workflow specific types
export interface ApprovalWorkflowConfig {
  steps: Array<{
    id: string;
    name: string;
    type: 'automated' | 'manual';
    validators?: string[];  // cross-check validators to run
    minConfidence?: number;
    approvers?: string[];  // user IDs for manual approval
    timeoutHours?: number;
    autoApproveOnTimeout?: boolean;
  }>;
  consensusRequired: boolean;
  fallbackAction: 'reject' | 'escalate' | 'manual-review';
}

export interface ApprovalRequest {
  id: string;
  workflowId: string;
  storyId: string;
  claim: string;
  status: 'pending' | 'in-review' | 'approved' | 'rejected' | 'escalated';
  currentStep: number;
  stepResults: Array<{
    stepId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: unknown;
    confidence?: number;
    startedAt: Date;
    completedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}
