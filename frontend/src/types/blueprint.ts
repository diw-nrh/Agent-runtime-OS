export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'local';

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  llmProvider: LLMProvider;
  modelId: string;
  tools: string[]; // List of MCP Tool IDs or Names
}

export interface NodeConfig {
  id: string;
  type: 'agent' | 'condition' | 'tool';
  data: Record<string, unknown>; // Payload specific to the node type
}

export interface EdgeConfig {
  id: string;
  source: string;
  target: string;
}

export interface AgentBlueprint {
  id: string;
  version: string;
  agents: AgentConfig[];
  nodes: NodeConfig[];
  edges: EdgeConfig[];
  metadata?: Record<string, unknown>;
}
