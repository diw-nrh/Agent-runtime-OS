import { useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { getBackendUrl } from '@/lib/utils';
import { useSettingsStore } from '@/store/settingsStore';
import { useToast } from '@/components/ui/Toast';

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
  const { toast } = useToast();

  useEffect(() => {
    if (!taskId) return;

    const backendUrl = getBackendUrl();
    const eventSource = new EventSource(`${backendUrl}/api/agent/stream/${taskId}`);
    
    let isClosing = false;
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, { status: data.status, message: data.message, data: data.data, time }]);
      
      if (data.status === 'COMPLETED') {
        console.log('[UI] Deployment completed successfully');
        toast.success("ดีพลอยเวิร์กโฟลว์ไปยังเอ็นจิ้นสำเร็จเรียบร้อยแล้ว!");
        isClosing = true;
        eventSource.close();
      } else if (data.status === 'ERROR') {
        console.error(`[Error] Deployment stream error: ${data.message}`);
        toast.error(`ดีพลอยล้มเหลว: ${data.message}`);
        isClosing = true;
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      if (!isClosing) {
        console.error('[Error] EventSource connection failed or disconnected');
        toast.error("การเชื่อมต่อสตรีมล้มเหลวหรือหลุดการเชื่อมต่อ");
        setLogs((prev) => [...prev, { status: 'ERROR', message: 'Connection to stream lost.', time: new Date().toLocaleTimeString() }]);
      }
      eventSource.close();
    };

    return () => eventSource.close();
  }, [taskId]);

  const deploy = async (nodes: Node[], edges: Edge[], blueprintId?: string, name?: string, description?: string) => {
    console.log('[UI] Starting blueprint deployment validation');
    toast.info("กำลังตรวจสอบข้อมูลความถูกต้อง...");
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
            systemPrompt: n.data.system_prompt 
              ? (n.data.system_prompt as string)
                  .replace(/<\/(p|div|h[1-6])>/gi, '\n')
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<[^>]*>?/gm, '')
                  .replace(/\n\s*\n/g, '\n')
              : 'You are a helpful assistant generated from canvas.',
            llmProvider: (conn?.provider || n.data.provider) === 'local' ? 'openai-compatible' : (conn?.provider || n.data.provider || 'openai-compatible'),
            modelId: n.data.model || '',
            tools: ((n.data.tools as string[]) || []).map((toolId: string) => {
              const custom = settings.customTools?.find(t => t.id === toolId);
              if (custom) {
                return { 
                  id: custom.id, 
                  name: custom.name, 
                  type: custom.type, 
                  url: custom.config?.url, 
                  command: custom.config?.command, 
                  args: custom.config?.args,
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
                  permissions: {
                    global: linked.globalPermission || 'allow',
                    tools: linked.toolPermissions || {}
                  }
                };
              }
              
              return { id: toolId, isGlobal: true };
            }),
            enableCustomLimits: !!n.data.enableCustomLimits,
            maxTokens: n.data.enableCustomLimits ? (n.data.maxTokens || 100000) : 100000,
            maxIterations: n.data.enableCustomLimits ? (n.data.maxIterations || 25) : 25,
            maxToolCalls: n.data.enableCustomLimits 
              ? (n.data.maxToolCalls ?? settings.executionSettings?.maxToolCalls ?? 1)
              : (settings.executionSettings?.maxToolCalls ?? 1),
            maxHandoffBounces: n.data.enableCustomLimits 
              ? (n.data.maxHandoffBounces ?? settings.executionSettings?.maxHandoffBounces ?? 1)
              : (settings.executionSettings?.maxHandoffBounces ?? 1),
            maxMemoryMessages: n.data.enableCustomLimits 
              ? (n.data.maxMemoryMessages ?? settings.executionSettings?.maxMemoryMessages ?? 10)
              : (settings.executionSettings?.maxMemoryMessages ?? 10),
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

      console.log('[UI] Sending deployment request to engine');
      toast.info("กำลังดีพลอยเวิร์กโฟลว์ไปยังเอ็นจิ้น...");
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
        console.error(`[Error] Deployment failed: ${err.message}`);
        toast.error(`Failed to deploy: ${err.message}`);
        setLogs(prev => [...prev, {status: 'ERROR', message: `Failed to deploy: ${err.message}`, time: new Date().toLocaleTimeString()}]);
      } else {
        console.error('[Error] Deployment failed with unknown error');
        toast.error("Failed to deploy: Unknown error");
        setLogs(prev => [...prev, {status: 'ERROR', message: `Failed to deploy: Unknown error`, time: new Date().toLocaleTimeString()}]);
      }
      setIsDeploying(false);
    }
  };

  const saveBlueprint = async (nodes: Node[], edges: Edge[], blueprintId?: string, name?: string, description?: string) => {
    console.log('[UI] Initiating save blueprint');
    toast.info("กำลังบันทึกเวิร์กสเปซ...");
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
            systemPrompt: n.data.system_prompt 
              ? (n.data.system_prompt as string)
                  .replace(/<\/(p|div|h[1-6])>/gi, '\n')
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<[^>]*>?/gm, '')
                  .replace(/\n\s*\n/g, '\n')
              : 'You are a helpful assistant generated from canvas.',
            llmProvider: (conn?.provider || n.data.provider) === 'local' ? 'openai-compatible' : (conn?.provider || n.data.provider || 'openai-compatible'),
            modelId: n.data.model || '',
            tools: ((n.data.tools as string[]) || []).map((toolId: string) => {
              const custom = settings.customTools?.find(t => t.id === toolId);
              if (custom) {
                return { 
                  id: custom.id, 
                  name: custom.name, 
                  type: custom.type, 
                  url: custom.config?.url, 
                  command: custom.config?.command, 
                  args: custom.config?.args,
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
                  permissions: {
                    global: linked.globalPermission || 'allow',
                    tools: linked.toolPermissions || {}
                  }
                };
              }
              return { id: toolId, isGlobal: true };
            }),
            enableCustomLimits: !!n.data.enableCustomLimits,
            maxTokens: n.data.enableCustomLimits ? (n.data.maxTokens || 100000) : 100000,
            maxIterations: n.data.enableCustomLimits ? (n.data.maxIterations || 25) : 25,
            maxToolCalls: n.data.enableCustomLimits 
              ? (n.data.maxToolCalls ?? settings.executionSettings?.maxToolCalls ?? 1)
              : (settings.executionSettings?.maxToolCalls ?? 1),
            maxHandoffBounces: n.data.enableCustomLimits 
              ? (n.data.maxHandoffBounces ?? settings.executionSettings?.maxHandoffBounces ?? 1)
              : (settings.executionSettings?.maxHandoffBounces ?? 1),
            maxMemoryMessages: n.data.enableCustomLimits 
              ? (n.data.maxMemoryMessages ?? settings.executionSettings?.maxMemoryMessages ?? 10)
              : (settings.executionSettings?.maxMemoryMessages ?? 10),
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
      
      console.log('[UI] Blueprint saved successfully');
      toast.success("บันทึกเวิร์กสเปซสำเร็จแล้ว");
      // Optional: show a quick success toast or log
      setLogs(prev => [...prev, {status: 'SUCCESS', message: 'Blueprint saved successfully.', time: new Date().toLocaleTimeString()}]);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`[Error] Save blueprint failed: ${err.message}`);
        toast.error(`บันทึกเวิร์กสเปซล้มเหลว: ${err.message}`);
        setLogs(prev => [...prev, {status: 'ERROR', message: `Failed to save: ${err.message}`, time: new Date().toLocaleTimeString()}]);
      } else {
        console.error('[Error] Save blueprint failed with unknown error');
        toast.error("บันทึกเวิร์กสเปซล้มเหลว: Unknown error");
      }
    } finally {
      setIsDeploying(false);
    }
  };

  const closeConsole = () => {
    setTaskId(null);
    setLogs([]);
  };

  const stopDeployment = async (taskId: string) => {
    try {
      const backendUrl = getBackendUrl();
      await fetch(`${backendUrl}/api/agent/stop/${taskId}`, { method: 'POST' });
      // Logic to close EventSource would be here if it's stored in a ref
      setTaskId(null);
      setLogs(prev => [...prev, {status: 'INFO', message: 'Deployment stopped.', time: new Date().toLocaleTimeString()}]);
    } catch (err) {
      console.error('Failed to stop deployment', err);
    }
  };

  return { deploy, saveBlueprint, stopDeployment, isDeploying, taskId, logs, closeConsole };
}
