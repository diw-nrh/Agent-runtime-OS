import type { Edge, Node } from '@xyflow/react';

// Database Models
export interface AgentBlueprint {
  id: string;
  name: string;
  description: string | null;
  canvasData: CanvasData;
  createdAt: Date;
  updatedAt: Date;
}

// Canvas Data
export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export type CanvasNode = Node<AgentNodeData | IONodeData, string>;
export type CanvasEdge = Edge<Record<string, unknown>>;

export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  systemPrompt?: string;
  modelId?: string;
  llmProvider?: string;
  maxToolCalls?: number;
  maxHandoffBounces?: number;
  maxMemoryMessages?: number;
  credentials?: {
    apiKey?: string;
    baseUrl?: string;
  };
  tools?: McpToolReference[];
}

export interface IONodeData extends Record<string, unknown> {
  label: string;
}

// Tools
export type McpToolReference = string | { id: string; name?: string };

export interface McpToolConfig {
  url?: string;
  command?: string;
  args?: string[];
}

export interface LinkedMcpTool {
  id: string;
  name: string;
  description?: string;
  versions: { version: string; config: McpToolConfig; createdAt: string }[];
  globalPermission?: string;
  toolPermissions?: Record<string, string>;
}

export interface CustomMcpTool {
  id: string;
  name: string;
  description: string;
  type: 'stdio' | 'sse';
  config: McpToolConfig;
  globalPermission?: string;
  toolPermissions?: Record<string, string>;
}

export type McpTool = LinkedMcpTool | CustomMcpTool;

// Trace / Logs
export interface TraceCall {
  name: string;
  inputs?: Record<string, unknown>;
  output?: unknown;
  error?: string;
}

export interface TraceContentData {
  agent?: string;
  content?: string;
  calls?: TraceCall[];
  error?: string;
}

export interface StreamLog {
  id: string;
  type: 'ai' | 'tool' | 'system' | 'human';
  content: string | TraceContentData;
  timestamp: string;
  agent?: string;
}
