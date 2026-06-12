"use client";

import { useState, useEffect, useRef } from "react";
import { NotebookEditor } from "@/components/notebook/Editor";
import { useSettingsStore } from "@/store/settingsStore";
import { useDeployBlueprint } from "@/hooks/useDeployBlueprint";
import { AlertCircle, Wrench, Bot, Link as LinkIcon, Settings2, ChevronDown, ChevronUp, Network, Plus, Settings, Database, Trash2, FileCode2, Maximize2, Minimize2, ExternalLink, MessageSquare } from "lucide-react";
import { Node, Edge } from "@xyflow/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/Select";

interface NotebookClientProps {
  projectId: string;
  blueprintId: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

export function NotebookClient({ projectId, blueprintId, initialNodes = [], initialEdges = [] }: NotebookClientProps) {
  const searchParams = useSearchParams();
  const requestedAgentId = searchParams.get("agentId");
  
  const { getProjectSettings } = useSettingsStore();
  const projSettings = getProjectSettings(projectId);
  const connections = projSettings.connections || [];
  const allProjectTools = [...(projSettings.linkedTools || []), ...(projSettings.customTools || [])];
  const skills = projSettings.skills || [];

  const [allNodes, setAllNodes] = useState<Node[]>(initialNodes);
  const [allEdges, setAllEdges] = useState<Edge[]>(initialEdges);
  
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    if (requestedAgentId && initialNodes.some(n => n.id === requestedAgentId)) {
      return requestedAgentId;
    }
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`notebook_last_agent_${projectId}`);
      if (saved && initialNodes.some(n => n.id === saved)) {
        return saved;
      }
    }
    return initialNodes.length > 0 ? initialNodes[0].id : "new_agent";
  });

  // Save selected agent to localStorage whenever it changes
  useEffect(() => {
    if (selectedAgentId && selectedAgentId !== "new_agent") {
      localStorage.setItem(`notebook_last_agent_${projectId}`, selectedAgentId);
    }
  }, [selectedAgentId, projectId]);

  // Form State
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [provider, setProvider] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isToolDropdownOpen, setIsToolDropdownOpen] = useState(false);
  const toolDropdownRef = useRef<HTMLDivElement>(null);

  // Close tool dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolDropdownRef.current && !toolDropdownRef.current.contains(e.target as Node)) {
        setIsToolDropdownOpen(false);
      }
    };
    if (isToolDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isToolDropdownOpen]);
  const [targetAgentId, setTargetAgentId] = useState("");
  
  // Advanced Limits State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [enableCustomLimits, setEnableCustomLimits] = useState(false);
  const [maxTokens, setMaxTokens] = useState(100000);
  const [maxIterations, setMaxIterations] = useState(25);
  const [maxToolCalls, setMaxToolCalls] = useState(1);
  
  // Editor re-mount key (to force Tiptap to load new content)
  const [editorKey, setEditorKey] = useState(0);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const editorRef = useRef<any>(null);

  // Global Dialog State for Agent descriptions
  const [agentDialog, setAgentDialog] = useState<{isOpen: boolean; agentName: string; agentDesc: string}>({
    isOpen: false,
    agentName: '',
    agentDesc: ''
  });

  const [isConnectionsFullscreen, setIsConnectionsFullscreen] = useState(false);
  const [showNewAgentConfirm, setShowNewAgentConfirm] = useState(false);
  
  const [newConnTarget, setNewConnTarget] = useState("");
  const [newConnMode, setNewConnMode] = useState("delegate");

  // Fix hydration mismatch for Zustand persist
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
    
    const handleOpenDesc = (e: any) => {
      setAgentDialog({
        isOpen: true,
        agentName: e.detail.agentName,
        agentDesc: e.detail.agentDesc
      });
    };
    
    window.addEventListener('openAgentDescription', handleOpenDesc);
    return () => window.removeEventListener('openAgentDescription', handleOpenDesc);
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const isDuplicateName = allNodes.some(
    n => n.id !== selectedAgentId && 
         n.type === 'agent' && 
         n.data.label?.toString().trim() === label.trim()
  );

  const { saveBlueprint, isDeploying } = useDeployBlueprint();

  // Load agent data into form when selection changes
  useEffect(() => {
    if (selectedAgentId === "new_agent") {
      setLabel("New Agent");
      setModel("");
      setConnectionId("");
      setProvider("");
      setSystemPrompt("");
      setSelectedTools([]);
      setTargetAgentId("");
      setEnableCustomLimits(false);
      setMaxTokens(100000);
      setMaxIterations(25);
      setMaxToolCalls(1);
      setEditorKey(prev => prev + 1); // Force editor refresh
    } else {
      const node = allNodes.find(n => n.id === selectedAgentId);
      if (node) {
        setLabel(node.data.label as string || "");
        setModel(node.data.model as string || "");
        setConnectionId(node.data.connectionId as string || "");
        setProvider(node.data.provider as string || "");
        setSystemPrompt(node.data.system_prompt as string || "");
        setSelectedTools((node.data.tools as string[]) || []);
        
        setEnableCustomLimits(!!node.data.enableCustomLimits);
        setMaxTokens((node.data.maxTokens as number) || 100000);
        setMaxIterations((node.data.maxIterations as number) || 25);
        setMaxToolCalls((node.data.maxToolCalls as number) ?? 1);
        
        setEditorKey(prev => prev + 1); // Force editor refresh
      }
    }
  }, [selectedAgentId, allNodes]);

  // Sync selectedAgentId to URL so it persists on refresh
  useEffect(() => {
    if (selectedAgentId && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('agentId', selectedAgentId);
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedAgentId]);

  const handleConnectionChange = (connId: string) => {
    if (!connId) {
      setConnectionId("");
      setProvider("");
      setModel("");
      return;
    }
    
    const selectedConn = connections.find(c => c.id === connId);
    if (selectedConn) {
      let defaultModel = "";
      if (selectedConn.provider === "openai-compatible") defaultModel = "gpt-4o-mini";
      if (selectedConn.provider === "local") defaultModel = "llama-3.1-8b";
      if (selectedConn.provider === "anthropic") defaultModel = "claude-3-5-sonnet-20240620";
      if (selectedConn.provider === "google") defaultModel = "gemini-1.5-pro";
      
      setConnectionId(connId);
      setProvider(selectedConn.provider);
      setModel(defaultModel);
    }
  };

  const handleSave = () => {
    let updatedNodes = [...allNodes];
    let updatedEdges = [...allEdges];
    let targetIdStr = selectedAgentId;

    if (selectedAgentId === "new_agent") {
      targetIdStr = `agent-${Date.now()}`;
      const newNode: Node = {
        id: targetIdStr,
        type: "agent",
        position: { x: 250, y: 150 + (allNodes.length * 100) }, // Offset new nodes
        data: {
          label,
          model,
          connectionId,
          provider,
          system_prompt: systemPrompt,
          tools: selectedTools,
          enableCustomLimits,
          maxTokens,
          maxIterations,
          maxToolCalls
        }
      };
      updatedNodes.push(newNode);
      setSelectedAgentId(targetIdStr);
    } else {
      updatedNodes = updatedNodes.map(n => 
        n.id === selectedAgentId ? {
          ...n,
          data: {
            ...n.data,
            label,
            model,
            connectionId,
            provider,
            system_prompt: systemPrompt,
            tools: selectedTools,
            enableCustomLimits,
            maxTokens,
            maxIterations,
            maxToolCalls
          }
        } : n
      );
    }


    setAllNodes(updatedNodes);
    setAllEdges(updatedEdges);
    saveBlueprint(updatedNodes, updatedEdges, blueprintId, "Agent Note", "Notebook generated agent");
  };

  const handleAddTool = (toolId: string) => {
    if (!selectedTools.includes(toolId)) {
      setSelectedTools(prev => [...prev, toolId]);
    }
  };

  if (!isMounted) {
    return <div className="flex h-full w-full items-center justify-center text-muted-foreground">Loading...</div>;
  }

  const selectedNode = allNodes.find(n => n.id === selectedAgentId);

  return (
    <div className="flex h-full w-full">
      {/* Main Editor Area */}
      <div className="flex-1 p-6 flex flex-col h-full overflow-y-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Note</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Press &apos;/&apos; for commands or type &apos;@&apos; to attach Tools. Use <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">@alias [Agent]</code> to hand off tasks to another Agent.
            </p>
          </div>
          
          {/* Item Selector */}
          <div className="w-72 glass-panel rounded-lg p-3 relative z-20">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Editing Element
              </label>
              <button 
                onClick={() => setShowNewAgentConfirm(true)}
                className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors flex items-center justify-center bg-background border shadow-sm"
                title="Create New Agent"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <Select
              value={selectedAgentId}
              onChange={(val) => setSelectedAgentId(val)}
              icon={<Bot size={16} className="text-primary" />}
              groups={[{
                label: "Canvas Agents",
                options: allNodes.length > 0 
                  ? allNodes.map(n => ({ value: n.id, label: n.data.label as string || "Unnamed Agent" }))
                  : [{ value: "", label: "No agents found", disabled: true }]
              }]}
            />
          </div>
        </div>
        <div className={`transition-all duration-300 flex flex-col ${isFullscreen ? 'fixed inset-4 z-50 glass-card rounded-xl shadow-2xl overflow-hidden' : 'flex-1 min-h-[400px] glass-card rounded-xl overflow-hidden border border-border/50 shadow-sm'}`}>
          <div className="flex justify-between items-center bg-primary/5 backdrop-blur-sm px-4 py-2 border-b border-border/50">
             <span className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">System Prompt</span>
             <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors bg-background px-2 py-1 rounded border shadow-sm">
               {isFullscreen ? <><Minimize2 size={12} /> Exit Fullscreen</> : <><Maximize2 size={12} /> Fullscreen</>}
             </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NotebookEditor 
              key={editorKey} // Force remount when agent switches
              projectId={projectId} 
              initialContent={systemPrompt} 
              onChange={(content) => setSystemPrompt(content)} 
              onAddTool={handleAddTool}
              editorRef={editorRef}
              availableAgents={allNodes.filter(n => n.id !== selectedAgentId && n.type === 'agent')}
              onAddAgentConnection={(targetId) => {
                if (allEdges.some(ed => ed.source === selectedAgentId && ed.target === targetId)) {
                  return; // already exists
                }
                const newEdgeId = `edge-${Date.now()}`;
                setAllEdges(edges => [...edges, {
                  id: newEdgeId,
                  source: selectedAgentId,
                  target: targetId,
                  type: 'configurable',
                  animated: true,
                  style: { strokeDasharray: '5,5' },
                  data: { mode: 'delegate', instruction: '' }
                }]);
              }}
            />
          </div>
        </div>
        {/* Agent Connections Section */}
        <div className={`transition-all duration-300 flex flex-col ${isConnectionsFullscreen ? 'fixed inset-4 z-50 glass-card rounded-xl shadow-2xl p-6 overflow-hidden' : 'mt-6 pt-6 border-t border-border/50'}`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2"><LinkIcon size={20}/> Agent Connections</h3>
              <p className="text-sm text-muted-foreground mt-1">Manage where this agent sends tasks or results. Each connection can have specific instructions.</p>
            </div>
            <button onClick={() => setIsConnectionsFullscreen(!isConnectionsFullscreen)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors bg-background px-2 py-1 rounded border shadow-sm">
               {isConnectionsFullscreen ? <><Minimize2 size={12} /> Exit Fullscreen</> : <><Maximize2 size={12} /> Fullscreen</>}
            </button>
          </div>
          
          <div className={`space-y-4 ${isConnectionsFullscreen ? 'overflow-y-auto flex-1 pr-2' : ''}`}>
            {/* Add Connection Inline UI */}
            <div className="glass-panel border-white/5 rounded-lg p-4 mb-6 shadow-sm">
              <h4 className="text-sm font-semibold mb-3 text-[#d4d4d4]">Add New Connection</h4>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Target Agent</label>
                  <Select 
                    value={newConnTarget}
                    onChange={(val) => setNewConnTarget(val)}
                    placeholder="Select Target..."
                    options={allNodes.filter(n => n.id !== selectedAgentId && (n.type === 'agent' || n.type === 'io_node')).map(n => ({ value: n.id, label: (n.data.label as string) || (n.type === 'io_node' ? 'System IO' : 'Unnamed Agent') }))}
                  />
                </div>
                <div className="w-1/3">
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Mode</label>
                  <Select 
                    value={newConnMode}
                    onChange={(val) => setNewConnMode(val)}
                    options={[
                      { value: "delegate", label: "Delegate (Handoff)" },
                      { value: "sequential", label: "Sequential (Pipeline)" }
                    ]}
                  />
                </div>
                <button 
                  onClick={() => {
                    const targetId = newConnTarget;
                    const mode = newConnMode;
                    
                    if (!targetId) return;
                    
                    // Check duplicate
                    if (allEdges.some(e => e.source === selectedAgentId && e.target === targetId)) {
                      alert("This agent is already connected to the selected target!");
                      return;
                    }
                    
                    const newEdge: Edge = {
                      id: `edge-${Date.now()}`,
                      source: selectedAgentId,
                      target: targetId,
                      type: 'configurable',
                      animated: true,
                      data: { mode, instruction: '' }
                    };
                    
                    setAllEdges(prev => [...prev, newEdge]);
                    setNewConnTarget("");
                  }}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {allEdges.filter(e => e.source === selectedAgentId).map(edge => {
              const targetNode = allNodes.find(n => n.id === edge.target);
              return (
                <div key={edge.id} className="border border-[#303030] rounded-lg bg-[#1a1a1a] flex items-center justify-between px-4 py-3 text-sm transition-all hover:border-[#505050] hover:bg-[#1e1e1e] group/edge">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center h-7 text-muted-foreground font-mono text-xs bg-black/40 px-2.5 rounded-md select-none border border-[#333]">
                      {edge.id}
                    </div>
                    
                    {/* Mode Select */}
                    <div className="relative group cursor-pointer h-7">
                      <select
                        value={(edge.data?.mode as string) || 'delegate'}
                        onChange={(e) => {
                          const newMode = e.target.value;
                          setAllEdges(edges => edges.map(ed => 
                            ed.id === edge.id ? { 
                              ...ed, 
                              data: { ...ed.data, mode: newMode },
                              animated: newMode === 'delegate',
                              style: newMode === 'delegate' ? { strokeDasharray: '5,5' } : undefined
                            } : ed
                          ));
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      >
                        <option value="delegate" className="bg-[#1e1e1e] text-blue-400">DELEGATE</option>
                        <option value="sequential" className="bg-[#1e1e1e] text-blue-400">SEQUENTIAL</option>
                      </select>
                      <div className="flex items-center h-7 gap-1.5 px-2.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 transition-all">
                        {(edge.data?.mode as string) || 'Delegate'}
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 group-hover:opacity-100"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                    
                    {/* Target Agent Select */}
                    <div className="flex items-center gap-2 relative h-7">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      
                      <div className="relative group cursor-pointer h-7">
                        <select
                          value={edge.target}
                          onChange={(e) => {
                            const newTarget = e.target.value;
                            if (allEdges.some(ed => ed.id !== edge.id && ed.source === selectedAgentId && ed.target === newTarget)) {
                              alert("This agent is already connected to the selected target!");
                              return;
                            }
                            setAllEdges(edges => edges.map(ed => 
                              ed.id === edge.id ? { ...ed, target: newTarget } : ed
                            ));
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        >
                          <option value="" disabled className="bg-[#1e1e1e]">Select Target...</option>
                          {allNodes.filter(n => n.id !== selectedAgentId && (n.type === 'agent' || n.type === 'io_node')).map(n => (
                            <option key={n.id} value={n.id} className="bg-[#1e1e1e]">{n.data.label as string}</option>
                          ))}
                        </select>
                        <div className="flex items-center h-7 gap-2 text-[#e0e0e0] text-xs font-medium px-3 rounded-md border border-[#404040] bg-[#252525] group-hover:bg-[#2a2a2a] group-hover:border-[#505050] transition-all shadow-sm">
                          {targetNode?.data?.label as string || 'Unknown Agent'}
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          if (targetNode) setSelectedAgentId(targetNode.id);
                        }}
                        className="opacity-0 group-hover/edge:opacity-100 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-[#303030] hover:bg-primary hover:text-primary-foreground text-muted-foreground px-2 py-1 rounded transition-all ml-1 border border-[#404040] hover:border-primary"
                        title="Go to Agent"
                      >
                        <ExternalLink size={10} /> Edit
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {edge.data?.mode === 'delegate' && (
                      <button
                        onClick={() => {
                          if (editorRef.current && targetNode) {
                            editorRef.current.chain().focus().insertContent({
                              type: 'agentDelegate',
                              attrs: {
                                agentId: targetNode.id,
                                agentName: targetNode.data.label || 'System IO',
                                agentDesc: targetNode.data.system_prompt || (targetNode.type === 'io_node' ? 'End or Output routing node.' : 'No description')
                              }
                            }).insertContent(' ').run();
                          } else if (!editorRef.current) {
                            alert("Editor not ready");
                          }
                        }}
                        className="text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 px-2.5 py-1.5 rounded-md transition-colors opacity-0 group-hover/edge:opacity-100 flex items-center gap-1.5"
                        title="Insert into System Prompt"
                      >
                        {targetNode?.type === 'io_node' ? <MessageSquare size={12} /> : <Bot size={12} />} Insert to Prompt
                      </button>
                    )}
                    <button 
                      onClick={() => setAllEdges(edges => edges.filter(e => e.id !== edge.id))}
                      className="text-muted-foreground hover:text-red-400 transition-all bg-black/20 hover:bg-red-500/10 hover:border-red-500/30 border border-transparent p-1.5 rounded-md opacity-0 group-hover/edge:opacity-100"
                      title="Remove connection"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}

            {allEdges.filter(e => e.source === selectedAgentId).length === 0 && (
              <div className="text-center p-8 border border-dashed border-[#404040] rounded-lg text-muted-foreground bg-[#1e1e1e]">
                <p className="text-sm">No outgoing connections yet.</p>
                <p className="text-xs mt-1">Add a connection above.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar for Configuration */}
      <div className="w-80 border-l bg-card p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
        {/* AGENT SETTINGS PANEL */}
        <div>
          <h3 className="font-semibold mb-2">Agent Configuration</h3>
          <p className="text-sm text-muted-foreground mb-4">Set the core parameters for this agent.</p>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium block">Agent Name</label>
                <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-mono">
                  {selectedAgentId}
                </span>
              </div>
              <input 
                type="text" 
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={`w-full p-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium ${isDuplicateName ? 'border-red-500 ring-1 ring-red-500' : ''}`} 
                placeholder="e.g. Code Reviewer" 
              />
              {isDuplicateName && (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={12} />
                  ชื่อซ้ำกับ Agent อื่น (อาจทำให้ AI สับสน)
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-medium">AI Connection</label>
                <Link 
                  href={`/project/${projectId}/settings`} 
                  className="text-[10px] flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
                >
                  <Plus size={10} /> Add New Connection
                </Link>
              </div>
              <Select 
                value={connectionId}
                onChange={handleConnectionChange}
                placeholder="Select Connection..."
                options={connections.map(conn => ({ value: conn.id, label: conn.name }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1.5">Model</label>
              <input 
                type="text" 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={!connectionId && !provider}
                className="w-full p-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50" 
                placeholder="e.g. gpt-4o, claude-3-5-sonnet" 
              />
            </div>
          </div>
        </div>

        {/* Advanced Limits Section */}
        <div className="pt-4 border-t">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-sm font-semibold mb-2 text-foreground hover:text-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={16} /> Advanced Limits
            </div>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {showAdvanced && (
            <div className="mt-3 space-y-4 p-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Override Global Limits</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Use custom limits for this agent.</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={enableCustomLimits}
                    onChange={(e) => setEnableCustomLimits(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className={`space-y-3 transition-opacity ${enableCustomLimits ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div>
                  <label className="text-xs font-medium block mb-1">Max Tokens</label>
                  <input
                    type="number"
                    className="w-full text-sm p-2 bg-background border rounded-md outline-none focus:ring-2 focus:ring-primary/50"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                    min={100}
                    step={1000}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Max Iterations (Loops)</label>
                  <input
                    type="number"
                    className="w-full text-sm p-2 bg-background border rounded-md outline-none focus:ring-2 focus:ring-primary/50"
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(parseInt(e.target.value) || 0)}
                    min={1}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium">Max Tool Calls</label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <span className="text-[10px] text-muted-foreground">Infinite</span>
                      <div className="relative inline-flex items-center">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={maxToolCalls === -1}
                          onChange={(e) => setMaxToolCalls(e.target.checked ? -1 : 1)}
                        />
                        <div className="w-6 h-3.5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.5px] after:left-[1.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </div>
                    </label>
                  </div>
                  <input
                    type="number"
                    className="w-full text-sm p-2 bg-background border rounded-md outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                    value={maxToolCalls === -1 ? '' : (maxToolCalls ?? 1)}
                    onChange={(e) => setMaxToolCalls(parseInt(e.target.value) || 1)}
                    min={1}
                    disabled={maxToolCalls === -1}
                    placeholder={maxToolCalls === -1 ? "Unlimited" : "Enter max tool calls"}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="pt-6 border-t">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><FileCode2 size={16}/> Project Skills</h3>
          {skills.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg border border-dashed text-center">
              No skills created yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {skills.map(skill => (
                <div key={skill.id} className="flex items-center justify-between bg-amber-500/10 text-amber-600 px-3 py-2 rounded-md text-sm font-medium border border-amber-500/20">
                  <span className="truncate">{skill.name}</span>
                  <button 
                    onClick={() => {
                      if (editorRef.current) {
                        editorRef.current.chain().focus().insertContent({
                          type: 'skillMention',
                          attrs: {
                            id: skill.id,
                            label: skill.name,
                          }
                        }).insertContent(' ').run();
                      } else {
                        alert("Editor not ready");
                      }
                    }}
                    className="hover:bg-amber-500/20 rounded px-2 py-1 transition-colors text-xs flex items-center gap-1"
                    title="Insert Skill into Prompt"
                  >
                    <Plus size={12} /> Insert
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-6 border-t">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Wrench size={16}/> Attached Tools</h3>
            {allProjectTools.length > 0 && (
              <div className="relative" ref={toolDropdownRef}>
                <button 
                  onClick={() => setIsToolDropdownOpen(!isToolDropdownOpen)}
                  className="flex items-center gap-1 text-xs bg-primary/10 text-primary font-medium border border-primary/20 rounded-md px-2 py-1 cursor-pointer hover:bg-primary/20 transition-colors focus:outline-none"
                >
                  + Add Tools <ChevronDown className={`w-3 h-3 transition-transform ${isToolDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isToolDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-xl z-50 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-1 flex flex-col">
                      {allProjectTools.map(t => {
                        const isSelected = selectedTools.includes(t.id);
                        return (
                          <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer text-sm transition-colors">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTools(prev => [...prev, t.id]);
                                } else {
                                  setSelectedTools(prev => prev.filter(id => id !== t.id));
                                }
                              }}
                              className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 accent-primary cursor-pointer"
                            />
                            <span className="truncate flex-1 font-medium">{t.name || t.id}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {selectedTools.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg border border-dashed text-center">
              Type <kbd className="bg-background px-1.5 py-0.5 rounded border font-mono text-xs shadow-sm">@</kbd> in the editor or use <span className="font-medium text-primary">+ Add Tool</span> above.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedTools.map(toolId => {
                const toolObj = allProjectTools.find(t => t.id === toolId);
                return (
                  <div key={toolId} className="flex items-center justify-between bg-primary/10 text-primary px-3 py-2 rounded-md text-sm font-medium border border-primary/20">
                    <span className="truncate">{toolObj?.name || toolId}</span>
                    <button 
                      onClick={() => setSelectedTools(prev => prev.filter(t => t !== toolId))}
                      className="hover:bg-primary/20 rounded p-1 transition-colors"
                      title="Remove tool"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-auto pt-6">
          <button 
            onClick={handleSave}
            disabled={isDeploying || isDuplicateName}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium shadow-md hover:bg-primary/90 transition-all hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isDeploying ? (
              <>Saving...</>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
                Save Blueprint
              </>
            )}
          </button>
        </div>
      </div>
      <Dialog open={agentDialog.isOpen} onOpenChange={(open) => setAgentDialog(p => ({...p, isOpen: open}))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" />
              {agentDialog.agentName}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">Capabilities / System Prompt:</h4>
            <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto border">
              {agentDialog.agentDesc || 'No description available for this agent.'}
            </div>
            <p className="text-xs text-muted-foreground mt-4 italic">
              When tasks are delegated to this agent, it will follow these instructions.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for New Agent */}
      <Dialog open={showNewAgentConfirm} onOpenChange={setShowNewAgentConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Agent?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground mb-4 mt-2">
            Are you sure you want to create a new agent? Make sure you have saved any changes to your current agent, as unsaved progress will be lost.
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button 
              onClick={() => setShowNewAgentConfirm(false)}
              className="px-4 py-2 border rounded-md hover:bg-muted transition-colors text-sm"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                setShowNewAgentConfirm(false);
                setSelectedAgentId("new_agent");
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
            >
              Confirm & Create
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
