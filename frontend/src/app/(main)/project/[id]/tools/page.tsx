"use client";

import { useEffect, useState, use } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { McpTool, LinkedMcpTool, CustomMcpTool, McpToolConfig } from "@/types";
import { Plus, Trash2, Edit2, Wrench, Package, Link2, Unlink, Globe, Cpu, Activity, Loader2, CheckCircle2, XCircle, Shield, Hand, Ban, Check, Settings2 } from "lucide-react";
import { Select } from "@/components/ui/Select";

export default function ProjectToolsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  
  const { getProjectSettings, linkTool, unlinkTool, updateLinkedTool, addCustomTool, updateCustomTool, deleteCustomTool } = useSettingsStore();
  
  const [linkedTools, setLinkedTools] = useState<LinkedMcpTool[]>([]);
  const [customTools, setCustomTools] = useState<CustomMcpTool[]>([]);
  const [availableTools, setAvailableTools] = useState<LinkedMcpTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  
  const [showCustomToolModal, setShowCustomToolModal] = useState(false);
  const [editingCustomToolId, setEditingCustomToolId] = useState<string | null>(null);
  
  // Custom Tool Form State
  const [ctName, setCtName] = useState("");
  const [ctDesc, setCtDesc] = useState("");
  const [ctType, setCtType] = useState<'stdio' | 'sse'>('stdio');
  const [ctUrl, setCtUrl] = useState("");
  const [ctCommand, setCtCommand] = useState("");
  const [ctArgs, setCtArgs] = useState("");

  // Permissions Modal State
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsTool, setPermissionsTool] = useState<McpTool | null>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsAvailableTools, setPermissionsAvailableTools] = useState<{name: string, description?: string}[]>([]);
  const [tempPermissions, setTempPermissions] = useState<{ global: string, tools: Record<string, string> }>({ global: 'allow', tools: {} });

  const [testStatus, setTestStatus] = useState<Record<string, 'testing' | 'success' | 'error'>>({});
  const [modalTestStatus, setModalTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const testMcpConnection = async (type: 'stdio'|'sse', url: string, command: string, args: string[], toolId?: string) => {
    try {
      if (toolId) {
        setTestStatus(prev => ({ ...prev, [toolId]: 'testing' }));
      } else {
        setModalTestStatus('testing');
      }
      
      const res = await fetch('http://localhost:8000/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url: type === 'sse' ? url : undefined, command: type === 'stdio' ? command : undefined, args: type === 'stdio' ? args : undefined })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (toolId) setTestStatus(prev => ({ ...prev, [toolId]: 'error' }));
        else setModalTestStatus('error');
        alert("Connection Failed: " + (data.detail || "Unknown error"));
      } else {
        if (toolId) {
          setTestStatus(prev => ({ ...prev, [toolId]: 'success' }));
          setTimeout(() => setTestStatus(prev => { const n = {...prev}; delete n[toolId]; return n; }), 3000);
        } else {
          setModalTestStatus('success');
          setTimeout(() => setModalTestStatus('idle'), 3000);
        }
        if (data.tools && Array.isArray(data.tools)) {
          const toolsStr = data.tools.map((t: {name: string}) => `- ${t.name}`).join('\n');
          alert(`Success! Found ${data.tools.length} tools:\n${toolsStr}`);
        }
      }
    } catch (err) {
      if (toolId) setTestStatus(prev => ({ ...prev, [toolId]: 'error' }));
      else setModalTestStatus('error');
      alert("Failed to reach backend to test MCP connection.");
    }
  };

  useEffect(() => {
    const projSettings = getProjectSettings(projectId);
    setLinkedTools(projSettings.linkedTools || []);
    setCustomTools(projSettings.customTools || []);
    
    // Fetch available tools from global registry
    fetch('/api/mcp-registry')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableTools(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoadingTools(false));
  }, [projectId, getProjectSettings]);

  const handleOpenCustomModal = (tool?: CustomMcpTool) => {
    if (tool) {
      setEditingCustomToolId(tool.id);
      setCtName(tool.name);
      setCtDesc(tool.description || "");
      setCtType(tool.type);
      setCtUrl(tool.config.url || "");
      setCtCommand(tool.config.command || "");
      setCtArgs((tool.config.args || []).join(" "));
    } else {
      setEditingCustomToolId(null);
      setCtName("");
      setCtDesc("");
      setCtType("stdio");
      setCtUrl("");
      setCtCommand("");
      setCtArgs("");
    }
    setModalTestStatus('idle');
    setShowCustomToolModal(true);
  };

  const handleSaveCustomTool = (e: React.FormEvent) => {
    e.preventDefault();
    const newTool: CustomMcpTool = {
      id: editingCustomToolId || `ct_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: ctName,
      description: ctDesc,
      type: ctType,
      config: {
        url: ctType === 'sse' ? ctUrl : undefined,
        command: ctType === 'stdio' ? ctCommand : undefined,
        args: ctType === 'stdio' ? ctArgs.split(' ').filter(Boolean) : undefined,
      }
    };

    if (editingCustomToolId) {
      updateCustomTool(projectId, editingCustomToolId, newTool);
    } else {
      addCustomTool(projectId, newTool);
    }
    
    setCustomTools(getProjectSettings(projectId).customTools || []);
    setShowCustomToolModal(false);
  };

  const handleDeleteCustomTool = (id: string) => {
    if (confirm("Delete this custom tool?")) {
      deleteCustomTool(projectId, id);
      setCustomTools(getProjectSettings(projectId).customTools || []);
    }
  };

  const handleOpenPermissionsModal = async (tool: McpTool) => {
    setPermissionsTool(tool);
    setTempPermissions({
      global: tool.globalPermission || 'allow',
      tools: tool.toolPermissions || {}
    });
    setShowPermissionsModal(true);
    setPermissionsLoading(true);

    try {
      let toolType = 'stdio';
      let url: string | undefined;
      let command: string | undefined;
      let args: string[] | undefined;

      if ('type' in tool) {
        toolType = tool.type;
        url = tool.config?.url;
        command = tool.config?.command;
        args = tool.config?.args;
      } else {
        if (tool.versions?.[0]?.config) {
          const config = tool.versions[0].config as McpToolConfig & { type?: string };
          toolType = config.type || 'stdio';
          url = config.url;
          command = config.command;
          args = config.args;
        }
      }

      const res = await fetch('http://localhost:8000/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: toolType, url, command, args })
      });
      const data = await res.json();
      if (res.ok && data.tools) {
        setPermissionsAvailableTools(data.tools);
      } else {
        setPermissionsAvailableTools([]);
      }
    } catch (e) {
      setPermissionsAvailableTools([]);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const handleSavePermissions = () => {
    if (!permissionsTool) return;
    const updates = {
      globalPermission: tempPermissions.global,
      toolPermissions: tempPermissions.tools
    };
    
    // Check if it's a custom tool or linked tool
    if ('type' in permissionsTool) {
      updateCustomTool(projectId, permissionsTool.id, { ...permissionsTool, ...updates });
      setCustomTools(getProjectSettings(projectId).customTools || []);
    } else {
      updateLinkedTool(projectId, permissionsTool.id, updates);
      setLinkedTools(getProjectSettings(projectId).linkedTools || []);
    }
    setShowPermissionsModal(false);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full h-full bg-background">
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Wrench className="text-primary w-8 h-8" />
          MCP Tools
        </h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          Manage and configure MCP (Model Context Protocol) tools for this project. These tools can be attached to Agents to extend their capabilities.
        </p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight">Private Custom Tools</h2>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Create MCP tools that exist only within this project (e.g. Local SSE servers, private scripts).
              </p>
            </div>
            <button 
              onClick={() => handleOpenCustomModal()}
              className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-5 py-2.5 rounded-md font-medium hover:bg-secondary/80 transition-all shadow-sm shrink-0 whitespace-nowrap mt-1"
            >
              <Plus className="w-4 h-4" />
              Add Custom Tool
            </button>
          </div>

          {customTools.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-xl text-muted-foreground bg-muted/5">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No private custom tools configured.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customTools.map((tool) => (
                <div key={tool.id} onDoubleClick={() => handleOpenPermissionsModal(tool)} className="border rounded-xl p-5 flex flex-col bg-card shadow-sm hover:shadow transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-secondary text-secondary-foreground">
                        <Wrench size={16} />
                      </div>
                      <h3 className="font-semibold">{tool.name}</h3>
                    </div>
                    <div className="flex opacity-50 hover:opacity-100 transition-opacity gap-1">
                      <button 
                        onClick={() => testMcpConnection(tool.type, tool.config.url || "", tool.config.command || "", tool.config.args || [], tool.id)} 
                        disabled={testStatus[tool.id] === 'testing'} 
                        className={`p-1 rounded-md disabled:opacity-50 transition-colors ${
                          testStatus[tool.id] === 'success' ? 'text-green-500 hover:text-green-600' :
                          testStatus[tool.id] === 'error' ? 'text-red-500 hover:text-red-600' :
                          'text-muted-foreground hover:text-blue-500'
                        }`} 
                        title="Test Connection"
                      >
                        {testStatus[tool.id] === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                         testStatus[tool.id] === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                         testStatus[tool.id] === 'error' ? <XCircle className="w-4 h-4" /> :
                         <Activity className="w-4 h-4" />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenPermissionsModal(tool); }} className="p-1 text-muted-foreground hover:text-amber-500 rounded-md" title="Permissions">
                        <Shield className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenCustomModal(tool); }} className="p-1 text-muted-foreground hover:text-primary rounded-md" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomTool(tool.id); }} className="p-1 text-muted-foreground hover:text-destructive rounded-md" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 mb-3 line-clamp-2">{tool.description}</p>
                  <div className="mt-auto bg-muted/40 p-2 rounded text-xs font-mono text-muted-foreground flex items-center gap-2">
                    {tool.type === 'sse' ? <Globe size={12}/> : <Cpu size={12}/>}
                    <span className="font-bold uppercase tracking-wider text-foreground/70">{tool.type}</span>
                    <span className="truncate border-l pl-2 ml-1">
                      {tool.type === 'sse' ? tool.config.url : `${tool.config.command} ${(tool.config.args||[]).join(' ')}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto mt-16 pt-8 border-t">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight">Global Marketplace Integrations</h2>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Connect external tools from the public marketplace to this project.
              </p>
            </div>
          </div>

          {loadingTools ? (
            <div className="text-center py-12 text-muted-foreground animate-pulse">Loading tools...</div>
          ) : availableTools.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-muted/10">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-muted-foreground">No tools available in the global registry.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableTools.map((tool) => {
                const isLinked = linkedTools.some(t => t.id === tool.id);
                const linkedToolData = isLinked ? linkedTools.find(t => t.id === tool.id) : null;
                return (
                  <div key={tool.id} onDoubleClick={() => isLinked && linkedToolData && handleOpenPermissionsModal(linkedToolData)} className={`border rounded-xl p-5 flex flex-col transition-all ${isLinked ? 'bg-primary/5 border-primary/20 shadow-sm cursor-pointer' : 'bg-card opacity-80 hover:opacity-100'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${isLinked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          <Package size={16} />
                        </div>
                        <h3 className="font-semibold">{tool.name}</h3>
                      </div>
                      {isLinked ? (
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); if (linkedToolData) handleOpenPermissionsModal(linkedToolData); }} className="p-1 text-muted-foreground hover:text-amber-500 rounded-md transition-colors" title="Permissions">
                            <Shield className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              unlinkTool(projectId, tool.id);
                              setLinkedTools(prev => prev.filter(t => t.id !== tool.id));
                            }}
                            className="text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
                          >
                            <Unlink size={12} /> Remove
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            linkTool(projectId, tool);
                            setLinkedTools(prev => [...prev, tool]);
                          }}
                          className="text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
                        >
                          <Link2 size={12} /> Connect
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 mb-3 line-clamp-2 flex-1">{tool.description}</p>
                    {tool.versions?.[0]?.config && (
                      <div className="mt-auto bg-muted/40 p-2 rounded text-xs font-mono text-muted-foreground flex items-center gap-2">
                        {tool.versions[0].config.url ? <Globe size={12}/> : <Cpu size={12}/>}
                        <span className="font-bold uppercase tracking-wider text-foreground/70">{tool.versions[0].config.url ? 'SSE' : 'STDIO'}</span>
                        <span className="truncate border-l pl-2 ml-1">
                          {tool.versions[0].config.url ? tool.versions[0].config.url : `${tool.versions[0].config.command} ${(tool.versions[0].config.args||[]).join(' ')}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Custom Tool Modal */}
      {showCustomToolModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{editingCustomToolId ? "Edit Custom Tool" : "Add Custom Tool"}</h2>
              
              <form onSubmit={handleSaveCustomTool} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tool Name</label>
                  <input 
                    type="text" required value={ctName} onChange={(e) => setCtName(e.target.value)}
                    placeholder="e.g. My Local Database"
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input 
                    type="text" value={ctDesc} onChange={(e) => setCtDesc(e.target.value)}
                    placeholder="Brief description of the tool"
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Transport Type</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={ctType === 'stdio'} onChange={() => setCtType('stdio')} /> Stdio
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={ctType === 'sse'} onChange={() => setCtType('sse')} /> SSE (HTTP)
                    </label>
                  </div>
                </div>

                {ctType === 'sse' ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">SSE URL</label>
                    <input 
                      type="url" required value={ctUrl} onChange={(e) => setCtUrl(e.target.value)}
                      placeholder="http://localhost:8000/sse"
                      className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-sm font-medium mb-1">Command</label>
                      <input 
                        type="text" required value={ctCommand} onChange={(e) => setCtCommand(e.target.value)}
                        placeholder="npx"
                        className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Args</label>
                      <input 
                        type="text" value={ctArgs} onChange={(e) => setCtArgs(e.target.value)}
                        placeholder="-y @modelcontextprotocol..."
                        className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-8">
                  <button 
                    type="button" 
                    onClick={() => testMcpConnection(ctType, ctUrl, ctCommand, ctArgs.split(' ').filter(Boolean))} 
                    disabled={modalTestStatus === 'testing'} 
                    className={`px-4 py-2 text-sm border rounded-md transition-colors flex items-center gap-2 mr-auto disabled:opacity-50 ${
                      modalTestStatus === 'success' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20' :
                      modalTestStatus === 'error' ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20' :
                      'hover:bg-blue-500/10 text-blue-500 hover:text-blue-600'
                    }`}
                  >
                    {modalTestStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                     modalTestStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                     modalTestStatus === 'error' ? <XCircle className="w-4 h-4" /> :
                     <Activity className="w-4 h-4" />}
                    {modalTestStatus === 'success' ? 'Connected!' : modalTestStatus === 'error' ? 'Failed' : 'Test Connection'}
                  </button>
                  <button type="button" onClick={() => setShowCustomToolModal(false)} className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                    Save Tool
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && permissionsTool && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-2xl rounded-xl shadow-lg border overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center bg-muted/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <Shield size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{permissionsTool.name}</h2>
                  <p className="text-sm text-muted-foreground">Tool permissions</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-muted-foreground mb-6">
                Choose when the AI Agent is allowed to use these tools.
              </p>
              
              <div className="flex items-center justify-between mb-6 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">All tools in this server</h3>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{permissionsAvailableTools.length}</span>
                </div>
                
                <Select 
                  value={tempPermissions.global}
                  onChange={(val) => setTempPermissions(prev => ({ ...prev, global: val }))}
                  options={[
                    { value: 'allow', label: 'Always allow', icon: <CheckCircle2 className="text-green-500 w-4 h-4" /> },
                    { value: 'ask', label: 'Needs approval', icon: <Hand className="text-amber-500 w-4 h-4" /> },
                    { value: 'block', label: 'Blocked', icon: <Ban className="text-red-500 w-4 h-4" /> },
                    { value: 'custom', label: 'Custom', icon: <Settings2 className="text-muted-foreground w-4 h-4" /> }
                  ]}
                  className="w-48"
                />
              </div>

              {permissionsLoading ? (
                <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" />
                  <p>Loading tools...</p>
                </div>
              ) : permissionsAvailableTools.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground border border-dashed rounded-lg">
                  <Ban className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p>No sub-tools found or failed to connect to the server.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {permissionsAvailableTools.map(t => {
                    // if global is custom, use tool specific or default to ask
                    // if global is not custom, we ignore tool specific visually, but we can let them override it?
                    // Actually let's make it so if they click a tool toggle, global becomes "custom".
                    const effectivePerm = tempPermissions.global === 'custom' 
                      ? (tempPermissions.tools[t.name] || 'ask') 
                      : tempPermissions.global;
                      
                    const handleToolPermChange = (perm: string) => {
                      setTempPermissions(prev => ({
                        global: 'custom',
                        tools: { ...prev.tools, [t.name]: perm }
                      }));
                    };

                    return (
                      <div key={t.name} className="flex items-center justify-between py-3 px-4 hover:bg-muted/30 rounded-lg transition-colors group">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{t.name}</span>
                          {t.description && <span className="text-xs text-muted-foreground line-clamp-1 max-w-sm">{t.description}</span>}
                        </div>
                        
                        <div className="flex bg-muted rounded-lg p-1 border">
                          <button 
                            onClick={() => handleToolPermChange('allow')}
                            className={`p-1.5 rounded-md transition-all ${effectivePerm === 'allow' ? 'bg-background shadow-sm text-green-600 dark:text-green-400' : 'text-muted-foreground hover:text-foreground opacity-50'}`}
                            title="Always allow"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToolPermChange('ask')}
                            className={`p-1.5 rounded-md transition-all ${effectivePerm === 'ask' ? 'bg-background shadow-sm text-amber-600 dark:text-amber-400' : 'text-muted-foreground hover:text-foreground opacity-50'}`}
                            title="Needs approval"
                          >
                            <Hand className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleToolPermChange('block')}
                            className={`p-1.5 rounded-md transition-all ${effectivePerm === 'block' ? 'bg-background shadow-sm text-red-600 dark:text-red-400' : 'text-muted-foreground hover:text-foreground opacity-50'}`}
                            title="Blocked"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-muted/10 flex justify-end gap-3 mt-auto">
              <button onClick={() => setShowPermissionsModal(false)} className="px-5 py-2 text-sm border rounded-lg hover:bg-muted transition-colors font-medium">
                Cancel
              </button>
              <button onClick={handleSavePermissions} className="px-5 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium">
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
