import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Bot, AlertCircle, Wrench } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useSettingsStore } from '@/store/settingsStore';
import { AgentNodeProps } from '@/types/canvas';

// Global cache for tools to prevent multiple fetches
let cachedTools: any[] | null = null;
let fetchingPromise: Promise<any[]> | null = null;

export function AgentNode({ id, data }: AgentNodeProps) {
  const { updateNodeData } = useReactFlow();
  const params = useParams();
  const projectId = params?.id as string;
  
  const { getProjectSettings } = useSettingsStore();
  const connections = getProjectSettings(projectId).connections || [];

  const [availableTools, setAvailableTools] = useState<any[]>(cachedTools || []);
  
  // Local state to preserve native undo/redo history in inputs
  const [localLabel, setLocalLabel] = useState(data.label || '');
  const [localPrompt, setLocalPrompt] = useState(data.system_prompt || '');
  const [localModel, setLocalModel] = useState(data.model || '');

  // Sync local state if data changes from outside (e.g. loading a new blueprint)
  useEffect(() => { setLocalLabel(data.label || ''); }, [data.label]);
  useEffect(() => { setLocalPrompt(data.system_prompt || ''); }, [data.system_prompt]);
  useEffect(() => { setLocalModel(data.model || ''); }, [data.model]);

  // Fetch tools
  useEffect(() => {
    if (cachedTools) {
      setAvailableTools(cachedTools);
      return;
    }
    
    if (!fetchingPromise) {
      fetchingPromise = fetch('/api/mcp/tools')
        .then(res => res.json())
        .then(json => json.tools || []);
    }
    
    fetchingPromise.then(tools => {
      cachedTools = tools;
      setAvailableTools(tools);
    }).catch(err => {
      console.error("Error fetching tools", err);
    });
  }, []);

  const handleLabelBlur = () => updateNodeData(id, { ...data, label: localLabel });
  const handlePromptBlur = () => updateNodeData(id, { ...data, system_prompt: localPrompt });
  const handleModelBlur = () => updateNodeData(id, { ...data, model: localModel });

  const handleConnectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const connId = e.target.value;
    if (!connId) {
      updateNodeData(id, { ...data, connectionId: undefined, provider: undefined, model: undefined });
      setLocalModel('');
      return;
    }
    
    const selectedConn = connections.find(c => c.id === connId);
    if (selectedConn) {
      let defaultModel = '';
      if (selectedConn.provider === 'openai-compatible') defaultModel = 'gpt-4o-mini';
      if (selectedConn.provider === 'anthropic') defaultModel = 'claude-3-5-sonnet-20240620';
      if (selectedConn.provider === 'google') defaultModel = 'gemini-1.5-pro';
      
      setLocalModel(defaultModel);
      updateNodeData(id, { 
        ...data, 
        connectionId: connId, 
        provider: selectedConn.provider, 
        model: defaultModel 
      });
    }
  };

  const handleToolToggle = (toolId: string) => {
    const currentTools: string[] = data.tools || [];
    let newTools;
    if (currentTools.includes(toolId)) {
      newTools = currentTools.filter(t => t !== toolId);
    } else {
      newTools = [...currentTools, toolId];
    }
    updateNodeData(id, { ...data, tools: newTools });
  };

  const currentConnection = connections.find(c => c.id === data.connectionId);
  const currentProvider = currentConnection?.provider || data.provider; // Fallback to data.provider for backwards compatibility

  return (
    <div className="bg-card text-card-foreground border shadow-sm rounded-xl w-72 overflow-hidden">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-primary border-2 border-background" />
      
      {/* Node Header */}
      <div className="bg-primary/10 p-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-2 w-full">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-md shadow-sm shrink-0">
            <Bot size={16} />
          </div>
          <input 
            value={localLabel} 
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={handleLabelBlur}
            placeholder="Agent Name"
            className="font-semibold text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 w-full rounded px-1 nodrag"
          />
        </div>
      </div>
      
      {/* Node Body */}
      <div className="p-4 bg-background flex flex-col gap-3 max-h-[400px] overflow-y-auto nodrag">
        <div>
          <div className="text-xs text-muted-foreground mb-1 font-medium">System Prompt</div>
          <textarea
            className="w-full text-xs p-2 bg-muted border rounded-md resize-none outline-none focus:border-primary/50 h-20 nodrag"
            placeholder="You are a helpful assistant..."
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            onBlur={handlePromptBlur}
          />
        </div>
        
        {/* Tools Selection */}
        <div>
          <div className="text-xs text-muted-foreground mb-1 font-medium flex items-center gap-1">
            <Wrench size={12} /> Capabilities (Tools)
          </div>
          <div className="bg-muted/50 p-2 rounded-md border space-y-1.5 max-h-24 overflow-y-auto">
            {availableTools.length === 0 ? (
              <div className="text-[10px] text-muted-foreground italic text-center py-1">Loading tools...</div>
            ) : (
              availableTools.map(tool => (
                <label key={tool.id} className="flex items-start gap-2 text-[11px] cursor-pointer hover:bg-muted p-1 rounded transition-colors">
                  <input 
                    type="checkbox" 
                    className="mt-0.5 rounded border-input text-primary focus:ring-primary/50"
                    checked={(data.tools || []).includes(tool.id)}
                    onChange={() => handleToolToggle(tool.id)}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{tool.name}</span>
                    <span className="text-[9px] text-muted-foreground leading-tight">{tool.description}</span>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-muted-foreground font-medium">AI Connection</div>
              {connections.length === 0 && (
                <div className="text-[10px] text-destructive flex items-center gap-1">
                  <AlertCircle size={10} /> No connections
                </div>
              )}
            </div>
            <select
              className="w-full text-xs p-2 bg-muted border rounded-md outline-none focus:border-primary/50 nodrag"
              value={data.connectionId || ''}
              onChange={handleConnectionChange}
            >
              <option value="" disabled>Select Connection...</option>
              {connections.map(conn => (
                <option key={conn.id} value={conn.id}>
                  {conn.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1 font-medium">Model</div>
            <input
              type="text"
              placeholder="e.g. gpt-4o, claude-3-5-sonnet"
              className="w-full text-xs p-2 bg-muted border rounded-md outline-none focus:border-primary/50 disabled:opacity-50 nodrag"
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              onBlur={handleModelBlur}
              disabled={!currentConnection && !data.provider}
            />
          </div>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-background" />
    </div>
  );
}
