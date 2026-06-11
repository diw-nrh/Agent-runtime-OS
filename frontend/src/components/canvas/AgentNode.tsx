import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Bot, AlertCircle, Wrench, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useSettingsStore } from '@/store/settingsStore';
import { AgentNodeProps } from '@/types/canvas';
import { NotebookEditor } from '../notebook/Editor';

// Remove the global cache since we now use project settings
export function AgentNode({ id, data }: AgentNodeProps) {
  const { updateNodeData, getNodes } = useReactFlow();
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  
  const { getProjectSettings } = useSettingsStore();
  const projSettings = getProjectSettings(projectId);
  const connections = projSettings.connections || [];
  const linkedTools = projSettings.linkedTools || [];
  const customTools = projSettings.customTools || [];
  
  // Combine all tools available to this project
  const allProjectTools = [...linkedTools, ...customTools];

  // Local state to preserve native undo/redo history in inputs
  const [localLabel, setLocalLabel] = useState(data.label || '');
  const [localPrompt, setLocalPrompt] = useState(data.system_prompt || '');
  const [localModel, setLocalModel] = useState(data.model || '');
  
  // Advanced Limits State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enableCustomLimits, setEnableCustomLimits] = useState(!!data.enableCustomLimits);
  const [maxTokens, setMaxTokens] = useState(data.maxTokens || 100000);
  const [maxIterations, setMaxIterations] = useState(data.maxIterations || 25);

  // Sync local state if data changes from outside (e.g. loading a new blueprint)
  useEffect(() => { setLocalLabel(data.label || ''); }, [data.label]);
  useEffect(() => { setLocalPrompt(data.system_prompt || ''); }, [data.system_prompt]);
  useEffect(() => { setLocalModel(data.model || ''); }, [data.model]);

  const handleLabelBlur = () => {
    let finalLabel = localLabel.trim() || 'Unnamed Agent';
    const otherNodes = getNodes().filter(n => n.id !== id && n.type === 'agent');
    
    if (otherNodes.some(n => n.data.label === finalLabel)) {
      let counter = 1;
      let newLabel = `${finalLabel} (${counter})`;
      while (otherNodes.some(n => n.data.label === newLabel)) {
        counter++;
        newLabel = `${finalLabel} (${counter})`;
      }
      finalLabel = newLabel;
      setLocalLabel(finalLabel);
    }
    
    updateNodeData(id, { ...data, label: finalLabel });
  };
  const handlePromptBlur = () => updateNodeData(id, { ...data, system_prompt: localPrompt });
  const handleModelBlur = () => updateNodeData(id, { ...data, model: localModel });

  const handleCustomLimitsToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEnableCustomLimits(checked);
    updateNodeData(id, { ...data, enableCustomLimits: checked, maxTokens, maxIterations });
  };

  const handleTokensBlur = () => {
    updateNodeData(id, { ...data, maxTokens });
  };

  const handleIterationsBlur = () => {
    updateNodeData(id, { ...data, maxIterations });
  };

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
      if (selectedConn.provider === 'local') defaultModel = 'llama-3.1-8b';
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

  const handleAddTool = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const toolId = e.target.value;
    if (!toolId) return;
    const currentTools: string[] = (data.tools as string[]) || [];
    if (!currentTools.includes(toolId)) {
      updateNodeData(id, { ...data, tools: [...currentTools, toolId] });
    }
    // Reset select
    e.target.value = "";
  };

  const handleRemoveTool = (toolId: string) => {
    const currentTools: string[] = (data.tools as string[]) || [];
    updateNodeData(id, { ...data, tools: currentTools.filter(t => t !== toolId) });
  };

  const currentConnection = connections.find(c => c.id === data.connectionId);
  const currentProvider = currentConnection?.provider || data.provider; // Fallback to data.provider for backwards compatibility

  const currentToolIds: string[] = (data.tools as string[]) || [];
  const availableToolsToAdd = allProjectTools.filter(t => !currentToolIds.includes(t.id));

  const handleDoubleClick = () => {
    router.push(`/project/${projectId}/notebook?agentId=${id}`);
  };

  const handleSourceDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const customEvent = new CustomEvent('openEdgeModal', { detail: { sourceId: id } });
    window.dispatchEvent(customEvent);
  };

  return (
    <div 
      onDoubleClick={handleDoubleClick}
      className="bg-card text-card-foreground border shadow-sm rounded-xl w-72 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    >
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
          <NotebookEditor
            projectId={projectId}
            initialContent={localPrompt}
            onChange={(content) => setLocalPrompt(content)}
            onBlur={handlePromptBlur}
            availableAgents={getNodes().filter(n => n.id !== id && n.type === 'agent')}
            minimal={true}
          />
        </div>
        
        {/* Tools Selection (Select + Tags UI) */}
        <div>
          <div className="text-xs text-muted-foreground mb-1 font-medium flex items-center gap-1">
            <Wrench size={12} /> Project Tools
          </div>
          
          {allProjectTools.length === 0 ? (
            <div className="text-[10px] text-muted-foreground bg-muted/20 p-2 rounded-md border border-dashed border-border leading-tight">
              No tools connected. Go to <a href={`/project/${projectId}/settings`} className="font-bold underline hover:text-primary transition-colors">Project Settings</a> to link tools.
            </div>
          ) : (
            <div className="space-y-2">
              <select 
                className="w-full text-xs p-2 bg-muted border rounded-md outline-none focus:border-primary/50 nodrag cursor-pointer"
                onChange={handleAddTool}
                value=""
              >
                <option value="" disabled>+ Add Tool...</option>
                {availableToolsToAdd.map(tool => (
                  <option key={tool.id} value={tool.id}>
                    {tool.type ? `[Private] ${tool.name}` : tool.name}
                  </option>
                ))}
              </select>
              
              {/* Selected Tool Tags */}
              {currentToolIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {currentToolIds.map(toolId => {
                    const toolObj = allProjectTools.find(t => t.id === toolId);
                    return (
                      <div key={toolId} className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-medium border border-primary/20">
                        {toolObj?.name || toolId}
                        <button onClick={() => handleRemoveTool(toolId)} className="hover:bg-primary/20 rounded-full p-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
              value={(data.connectionId as string) || ''}
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

        {/* Advanced Limits Section */}
        <div className="border-t pt-2 mt-1">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-1">
              <Settings2 size={12} /> Advanced Limits
            </div>
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          
          {showAdvanced && (
            <div className="mt-3 space-y-3 p-2 bg-muted/30 rounded-md border border-border/50">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-medium text-muted-foreground">Override Global Limits</div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={enableCustomLimits}
                    onChange={handleCustomLimitsToggle}
                  />
                  <div className="w-7 h-4 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className={`space-y-2 transition-opacity ${enableCustomLimits ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">Max Tokens</div>
                  <input
                    type="number"
                    className="w-full text-xs p-1.5 bg-background border rounded-md outline-none focus:border-primary/50 nodrag"
                    value={Number(maxTokens)}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                    onBlur={handleTokensBlur}
                    min={100}
                    step={1000}
                  />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1">Max Iterations</div>
                  <input
                    type="number"
                    className="w-full text-xs p-1.5 bg-background border rounded-md outline-none focus:border-primary/50 nodrag"
                    value={Number(maxIterations)}
                    onChange={(e) => setMaxIterations(parseInt(e.target.value) || 0)}
                    onBlur={handleIterationsBlur}
                    min={1}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-primary border-2 border-background" 
        onDoubleClick={handleSourceDoubleClick}
      />
    </div>
  );
}
