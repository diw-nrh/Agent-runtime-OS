import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Bot, AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useSettingsStore } from '@/store/settingsStore';
import { AgentNodeProps } from '@/types/canvas';

export function AgentNode({ id, data }: AgentNodeProps) {
  const { updateNodeData } = useReactFlow();
  const params = useParams();
  const projectId = params?.id as string;
  
  const { getProjectSettings } = useSettingsStore();
  const connections = getProjectSettings(projectId).connections || [];

  const handleSystemPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { ...data, system_prompt: e.target.value });
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { ...data, label: e.target.value });
  };

  const handleConnectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const connId = e.target.value;
    if (!connId) {
      updateNodeData(id, { ...data, connectionId: undefined, provider: undefined, model: undefined });
      return;
    }
    
    const selectedConn = connections.find(c => c.id === connId);
    if (selectedConn) {
      let defaultModel = 'openai/gpt-4o-mini';
      if (selectedConn.provider === 'groq') defaultModel = 'llama-3.1-8b-instant';
      if (selectedConn.provider === 'local') defaultModel = 'llama3';
      
      updateNodeData(id, { 
        ...data, 
        connectionId: connId, 
        provider: selectedConn.provider, 
        model: defaultModel 
      });
    }
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
            value={data.label || ''} 
            onChange={handleLabelChange}
            placeholder="Agent Name"
            className="font-semibold text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/50 w-full rounded px-1"
          />
        </div>
      </div>
      
      {/* Node Body */}
      <div className="p-4 bg-background flex flex-col gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1 font-medium">System Prompt</div>
          <textarea
            className="w-full text-xs p-2 bg-muted border rounded-md resize-none outline-none focus:border-primary/50 h-20"
            placeholder="You are a helpful assistant..."
            value={data.system_prompt || ''}
            onChange={handleSystemPromptChange}
          />
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
              className="w-full text-xs p-2 bg-muted border rounded-md outline-none focus:border-primary/50"
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
            <select
              className="w-full text-xs p-2 bg-muted border rounded-md outline-none focus:border-primary/50 disabled:opacity-50"
              value={data.model || 'openai/gpt-4o-mini'}
              onChange={(e) => updateNodeData(id, { ...data, model: e.target.value })}
              disabled={!currentConnection && !data.provider}
            >
              {(!currentProvider || currentProvider === 'openai') && (
                <>
                  <option value="openai/gpt-4o-mini">gpt-4o-mini</option>
                  <option value="openai/gpt-4o">gpt-4o</option>
                </>
              )}
              {currentProvider === 'groq' && (
                <>
                  <option value="llama-3.1-8b-instant">llama-3.1-8b</option>
                  <option value="mixtral-8x7b-32768">mixtral-8x7b</option>
                  <option value="llama3-70b-8192">llama3-70b</option>
                </>
              )}
              {currentProvider === 'local' && (
                <>
                  <option value="llama3">llama3</option>
                  <option value="mistral">mistral</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary border-2 border-background" />
    </div>
  );
}
