import { useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { useSettingsStore } from '@/store/settingsStore';

export interface TraceData {
  stepIndex: number;
  agentId: string;
  type: 'THOUGHT' | 'TOOL_CALL' | 'TOOL_RESULT' | 'MESSAGE' | 'ERROR';
  content: Record<string, unknown> | string | unknown;
}

export interface StreamLog {
  status: string;
  message: string;
  time: string;
  data?: TraceData;
}

export function useDeployBlueprint() {
  const { getProjectSettings } = useSettingsStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [logs, setLogs] = useState<StreamLog[]>([]);

  useEffect(() => {
    if (!taskId) return;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const eventSource = new EventSource(`${backendUrl}/api/agent/stream/${taskId}`);
    
    let isClosing = false;
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, { status: data.status, message: data.message, data: data.data, time }]);
      
      if (data.status === 'COMPLETED' || data.status === 'ERROR') {
        isClosing = true;
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      if (!isClosing) {
        setLogs((prev) => [...prev, { status: 'ERROR', message: 'Connection to stream lost.', time: new Date().toLocaleTimeString() }]);
      }
      eventSource.close();
    };

    return () => eventSource.close();
  }, [taskId]);

  const deploy = async (nodes: Node[], edges: Edge[], blueprintId?: string, name?: string, description?: string) => {
    setIsDeploying(true);
    setTaskId(null);
    setLogs([]);
    
    try {
      // Get settings specific to this project
      const settings = blueprintId ? getProjectSettings(blueprintId) : getProjectSettings('default');
      const connections = settings.connections || [];
      
      // Validate that all agents have a connection selected
      for (const n of nodes) {
        if (n.type === 'io_node') continue;
        if (!n.data.connectionId) {
          throw new Error(`Agent "${n.data.label || 'Unknown Agent'}" is missing an AI Connection. Please select one in the Canvas.`);
        }
        const connExists = connections.find(c => c.id === n.data.connectionId);
        if (!connExists) {
          throw new Error(`Agent "${n.data.label || 'Unknown Agent'}" has an invalid AI Connection. Please re-select it in the Canvas.`);
        }
      }
      
      const blueprint = {
        id: blueprintId,
        name: name || "Untitled Project",
        description: description || "A custom AI agent workflow blueprint.",
        version: "1.0.0",
        executionSettings: settings.executionSettings,
        agents: nodes.filter(n => n.type !== 'io_node').map(n => {
          // Find the selected connection for this node
          const conn = connections.find(c => c.id === n.data.connectionId);
          
          return {
            id: n.id,
            name: n.data.label || 'Unknown Agent',
            systemPrompt: n.data.system_prompt || 'You are a helpful assistant generated from canvas.',
            llmProvider: (conn?.provider || n.data.provider) === 'local' ? 'openai-compatible' : (conn?.provider || n.data.provider || 'openai-compatible'),
            modelId: n.data.model || '',
            tools: (n.data.tools || []).map((toolId: string) => {
              const custom = settings.customTools?.find(t => t.id === toolId);
              if (custom) {
                return { 
                  id: custom.id, 
                  name: custom.name, 
                  type: custom.type, 
                  url: custom.url, 
                  command: custom.command, 
                  args: custom.args 
                };
              }
              return { id: toolId, isGlobal: true };
            }),
            enableCustomLimits: !!n.data.enableCustomLimits,
            maxTokens: n.data.maxTokens || 100000,
            maxIterations: n.data.maxIterations || 25,
            agentNote: n.data.agent_note || '',
            credentials: {
              apiKey: conn?.apiKey || "",
              baseUrl: conn?.baseUrl || ""
            }
          };
        }),
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type || 'agent',
          position: n.position || { x: 0, y: 0 },
          measured: n.measured,
          data: n.data || {}
        })),
        edges: edges.map(e => ({
          ...e,
          mode: e.data?.mode || 'delegate'
        })),
        metadata: {}
      };

      const response = await fetch('/api/blueprints/deploy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // We can remove global headers since credentials are now node-specific,
          // but we leave them as fallback if the backend expects them.
        },
        body: JSON.stringify(blueprint)
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(`Deploy error: ${data.error}`);
      }
      
      setIsDeploying(false);
      setTaskId(data.taskId);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLogs(prev => [...prev, {status: 'ERROR', message: `Failed to deploy: ${err.message}`, time: new Date().toLocaleTimeString()}]);
      } else {
        setLogs(prev => [...prev, {status: 'ERROR', message: `Failed to deploy: Unknown error`, time: new Date().toLocaleTimeString()}]);
      }
      setIsDeploying(false);
    }
  };

  const saveBlueprint = async (nodes: Node[], edges: Edge[], blueprintId?: string, name?: string, description?: string) => {
    setIsDeploying(true); // Reusing the deploying state for loading UI
    
    try {
      const settings = blueprintId ? getProjectSettings(blueprintId) : getProjectSettings('default');
      const connections = settings.connections || [];
      
      const blueprint = {
        id: blueprintId,
        name: name || "Untitled Project",
        description: description || "A custom AI agent workflow blueprint.",
        version: "1.0.0",
        executionSettings: settings.executionSettings,
        agents: nodes.map(n => {
          const conn = connections.find(c => c.id === n.data.connectionId);
          return {
            id: n.id,
            name: n.data.label || 'Unknown Agent',
            systemPrompt: n.data.system_prompt || 'You are a helpful assistant generated from canvas.',
            llmProvider: (conn?.provider || n.data.provider) === 'local' ? 'openai-compatible' : (conn?.provider || n.data.provider || 'openai-compatible'),
            modelId: n.data.model || '',
            tools: (n.data.tools || []).map((toolId: string) => {
              const custom = settings.customTools?.find(t => t.id === toolId);
              if (custom) {
                return { 
                  id: custom.id, 
                  name: custom.name, 
                  type: custom.type, 
                  url: custom.config?.url || custom.url, 
                  command: custom.config?.command || custom.command, 
                  args: custom.config?.args || custom.args,
                  permissions: {
                    global: custom.globalPermission || 'allow',
                    tools: custom.toolPermissions || {}
                  }
                };
              }
              const linked = settings.linkedTools?.find(t => t.id === toolId);
              if (linked) {
                return { 
                  id: linked.id, 
                  isGlobal: true,
                  name: linked.name,
                  type: linked.type || 'stdio',
                  url: linked.config?.url,
                  command: linked.config?.command || linked.command,
                  args: linked.config?.args || linked.args,
                  permissions: {
                    global: linked.globalPermission || 'allow',
                    tools: linked.toolPermissions || {}
                  }
                };
              }
              return { id: toolId, isGlobal: true };
            }),
            enableCustomLimits: !!n.data.enableCustomLimits,
            maxTokens: n.data.maxTokens || 100000,
            maxIterations: n.data.maxIterations || 25,
            agentNote: n.data.agent_note || '',
            credentials: {
              apiKey: conn?.apiKey || "",
              baseUrl: conn?.baseUrl || ""
            }
          };
        }),
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type || 'agent',
          position: n.position || { x: 0, y: 0 },
          measured: n.measured,
          data: n.data || {}
        })),
        edges: edges.map(e => ({ 
          ...e,
          mode: e.data?.mode || 'delegate'
        })),
        metadata: {}
      };

      const response = await fetch('/api/blueprints/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blueprint)
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(`Save error: ${data.error}`);
      }
      
      // Optional: show a quick success toast or log
      setLogs(prev => [...prev, {status: 'SUCCESS', message: 'Blueprint saved successfully.', time: new Date().toLocaleTimeString()}]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setLogs(prev => [...prev, {status: 'ERROR', message: `Failed to save: ${err.message}`, time: new Date().toLocaleTimeString()}]);
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const closeConsole = () => {
    setTaskId(null);
    setLogs([]);
  };

  return { deploy, saveBlueprint, isDeploying, taskId, logs, closeConsole };
}
