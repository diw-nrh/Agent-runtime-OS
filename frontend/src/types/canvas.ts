export interface AgentNodeData {
  label?: string;
  model?: string;
  system_prompt?: string;
  [key: string]: unknown;
}

export interface AgentNodeProps {
  id: string;
  data: AgentNodeData;
}
