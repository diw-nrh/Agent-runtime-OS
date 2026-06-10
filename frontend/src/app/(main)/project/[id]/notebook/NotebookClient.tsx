"use client";

import { useState, useEffect } from "react";
import { NotebookEditor } from "@/components/notebook/Editor";
import { useSettingsStore } from "@/store/settingsStore";
import { useDeployBlueprint } from "@/hooks/useDeployBlueprint";
import { AlertCircle, Wrench, Bot, Link } from "lucide-react";
import { Node, Edge } from "@xyflow/react";

interface NotebookClientProps {
  projectId: string;
  blueprintId: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

export function NotebookClient({ projectId, blueprintId, initialNodes = [], initialEdges = [] }: NotebookClientProps) {
  const { getProjectSettings } = useSettingsStore();
  const projSettings = getProjectSettings(projectId);
  const connections = projSettings.connections || [];
  const allProjectTools = [...(projSettings.linkedTools || []), ...(projSettings.customTools || [])];

  const [allNodes, setAllNodes] = useState<Node[]>(initialNodes);
  const [allEdges, setAllEdges] = useState<Edge[]>(initialEdges);
  
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    initialNodes.length > 0 ? initialNodes[0].id : "new_agent"
  );

  // Form State
  const [label, setLabel] = useState("");
  const [model, setModel] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [provider, setProvider] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [targetAgentId, setTargetAgentId] = useState<string>("");
  
  // Editor re-mount key (to force Tiptap to load new content)
  const [editorKey, setEditorKey] = useState(0);

  // Fix hydration mismatch for Zustand persist
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
        
        const existingEdge = allEdges.find(e => e.source === selectedAgentId);
        setTargetAgentId(existingEdge ? existingEdge.target : "");
        
        setEditorKey(prev => prev + 1); // Force editor refresh
      }
    }
  }, [selectedAgentId, allNodes, allEdges]);

  const handleConnectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const connId = e.target.value;
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
          tools: selectedTools
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
            tools: selectedTools
          }
        } : n
      );
    }

    // Handle Edge Routing Update
    if (targetAgentId) {
      // Remove any existing edge from this source
      updatedEdges = updatedEdges.filter(e => e.source !== targetIdStr);
      // Add the new edge
      updatedEdges.push({
        id: `edge-${Date.now()}`,
        source: targetIdStr,
        target: targetAgentId,
        animated: true,
      });
    } else {
      // Remove edge if they selected "None"
      updatedEdges = updatedEdges.filter(e => e.source !== targetIdStr);
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

  return (
    <div className="flex h-full w-full">
      {/* Main Editor Area */}
      <div className="flex-1 p-6 flex flex-col h-full overflow-hidden">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Note</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Press &apos;/&apos; for commands or type &apos;@&apos; to mention and attach your AI Tools.
            </p>
          </div>
          
          {/* Agent Selector */}
          <div className="w-72 bg-card border rounded-lg p-3 shadow-sm">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Editing Agent
            </label>
            <div className="relative">
              <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <select 
                className="w-full pl-9 pr-4 py-2 border rounded-md bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
              >
                <optgroup label="Canvas Agents">
                  {allNodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.data.label as string || "Unnamed Agent"}
                    </option>
                  ))}
                  {allNodes.length === 0 && <option disabled>No agents found</option>}
                </optgroup>
                <optgroup label="Actions">
                  <option value="new_agent">✨ Create New Agent...</option>
                </optgroup>
              </select>
            </div>
          </div>
        </div>
        
        <div className="flex-1 min-h-0">
          <NotebookEditor 
            key={editorKey} // Force remount when agent switches
            projectId={projectId} 
            initialContent={systemPrompt} 
            onChange={(content) => setSystemPrompt(content)} 
            onAddTool={handleAddTool}
          />
        </div>
      </div>

      {/* Right Sidebar for Configuration */}
      <div className="w-80 border-l bg-card p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
        <div>
          <h3 className="font-semibold mb-2">Agent Configuration</h3>
          <p className="text-sm text-muted-foreground mb-4">Set the core parameters for this agent.</p>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Agent Name</label>
              <input 
                type="text" 
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full p-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium" 
                placeholder="e.g. Code Reviewer" 
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-medium">AI Connection</label>
                {connections.length === 0 && (
                  <div className="text-[10px] text-destructive flex items-center gap-1">
                    <AlertCircle size={10} /> No connections
                  </div>
                )}
              </div>
              <select 
                className="w-full p-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={connectionId}
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
        
        <div className="pt-6 border-t">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Link size={16}/> Workflow Routing</h3>
          <p className="text-[10px] text-muted-foreground mb-3 leading-tight">When this agent finishes its task, send the output to the next agent.</p>
          
          <select 
            className="w-full p-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
            value={targetAgentId}
            onChange={(e) => setTargetAgentId(e.target.value)}
          >
            <option value="">None (End of flow)</option>
            {allNodes
              .filter(n => n.id !== selectedAgentId) // Can't route to self
              .map(node => (
                <option key={node.id} value={node.id}>
                  {node.data.label as string || "Unnamed Agent"}
                </option>
            ))}
          </select>
        </div>

        <div className="pt-6 border-t">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Wrench size={16}/> Attached Tools</h3>
          {selectedTools.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg border border-dashed text-center">
              Type <kbd className="bg-background px-1.5 py-0.5 rounded border font-mono text-xs shadow-sm">@</kbd> in the editor to discover and attach tools.
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
            disabled={isDeploying}
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
    </div>
  );
}
