"use client";

import { useEffect, useState, use } from "react";
import { useSettingsStore, AIConnection, AIProviderType, CustomMcpTool } from "@/store/settingsStore";
import { Server, Plus, Trash2, Edit2, ShieldCheck, Cpu, Package, Link2, Unlink, Wrench, Globe } from "lucide-react";

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  
  const { getProjectSettings, addConnection, updateConnection, deleteConnection, linkTool, unlinkTool, addCustomTool, updateCustomTool, deleteCustomTool } = useSettingsStore();
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [linkedTools, setLinkedTools] = useState<any[]>([]);
  const [customTools, setCustomTools] = useState<CustomMcpTool[]>([]);
  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<AIProviderType>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    // Load connections and linked tools
    const projSettings = getProjectSettings(projectId);
    setConnections(projSettings.connections || []);
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
  }, [projectId, getProjectSettings, showModal]);

  const [showCustomToolModal, setShowCustomToolModal] = useState(false);
  const [editingCustomToolId, setEditingCustomToolId] = useState<string | null>(null);
  
  // Custom Tool Form State
  const [ctName, setCtName] = useState("");
  const [ctDesc, setCtDesc] = useState("");
  const [ctType, setCtType] = useState<'stdio' | 'sse'>('stdio');
  const [ctUrl, setCtUrl] = useState("");
  const [ctCommand, setCtCommand] = useState("");
  const [ctArgs, setCtArgs] = useState("");

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

  const handleOpenModal = (conn?: AIConnection) => {
    if (conn) {
      setEditingId(conn.id);
      setName(conn.name);
      setProvider(conn.provider);
      setApiKey(conn.apiKey || "");
      setBaseUrl(conn.baseUrl || "");
    } else {
      setEditingId(null);
      setName("");
      setProvider("openai-compatible");
      setApiKey("");
      setBaseUrl("https://api.openai.com/v1");
    }
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      updateConnection(projectId, editingId, { name, provider, apiKey, baseUrl });
    } else {
      const newConn: AIConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name,
        provider,
        apiKey: apiKey ? apiKey : undefined,
        baseUrl: provider === 'openai-compatible' ? baseUrl : undefined
      };
      addConnection(projectId, newConn);
    }
    
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this connection? Workflows using it will fail.")) {
      deleteConnection(projectId, id);
      setConnections(connections.filter(c => c.id !== id));
    }
  };

  const [activeTab, setActiveTab] = useState<'connections' | 'tools'>('connections');

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full h-full">
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Project Settings</h1>
        
        <div className="flex border-b mt-6">
          <button 
            className={`px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${activeTab === 'connections' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('connections')}
          >
            <Cpu size={16} /> AI Connections
            {activeTab === 'connections' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-md" />}
          </button>
          <button 
            className={`px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${activeTab === 'tools' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('tools')}
          >
            <Wrench size={16} /> MCP Tools
            {activeTab === 'tools' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-md" />}
          </button>
        </div>
      </div>

      {activeTab === 'connections' && (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight">AI Connections</h2>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Manage API keys and local server connections for this project. These are stored securely in your browser.
              </p>
            </div>
            <button 
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium hover:bg-primary/90 transition-all shadow-sm shrink-0 whitespace-nowrap mt-1"
            >
              <Plus className="w-4 h-4" />
              Add Connection
            </button>
          </div>

          {connections.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/10">
              <Cpu className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground">No Connections Yet</h3>
              <p className="mb-6">Add your first AI connection to start running agents.</p>
              <button 
                onClick={() => handleOpenModal()}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90"
              >
                Add Connection
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {connections.map((conn) => (
                <div key={conn.id} className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col group">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-2 rounded-lg ${
                        conn.provider === 'openai-compatible' ? 'bg-green-100 text-green-700' :
                        conn.provider === 'anthropic' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {conn.provider === 'openai-compatible' ? <Server className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                      </div>
                      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(conn)} className="p-1.5 text-muted-foreground hover:text-primary rounded-md">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(conn.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-lg line-clamp-1">{conn.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1 capitalize">{conn.provider} Provider</p>
                  </div>
                  <div className="bg-muted/30 border-t px-5 py-3 text-xs text-muted-foreground flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {conn.provider === 'openai-compatible' && conn.baseUrl ? conn.baseUrl : 'API Key Securely Stored'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tools' && (
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
                  <div key={tool.id} className="border rounded-xl p-5 flex flex-col bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-secondary text-secondary-foreground">
                          <Wrench size={16} />
                        </div>
                        <h3 className="font-semibold">{tool.name}</h3>
                      </div>
                      <div className="flex opacity-50 hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenCustomModal(tool)} className="p-1 text-muted-foreground hover:text-primary rounded-md">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteCustomTool(tool.id)} className="p-1 text-muted-foreground hover:text-destructive rounded-md">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 mb-3 line-clamp-2">{tool.description}</p>
                    <div className="mt-auto bg-muted/40 p-2 rounded text-xs font-mono text-muted-foreground flex items-center gap-2">
                      {tool.type === 'sse' ? <Globe size={12}/> : <Cpu size={12}/>}
                      <span className="truncate">
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
                  return (
                    <div key={tool.id} className={`border rounded-xl p-5 flex flex-col transition-all ${isLinked ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-card opacity-80 hover:opacity-100'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${isLinked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            <Package size={16} />
                          </div>
                          <h3 className="font-semibold">{tool.name}</h3>
                        </div>
                        {isLinked ? (
                          <button 
                            onClick={() => {
                              unlinkTool(projectId, tool.id);
                              setLinkedTools(prev => prev.filter(t => t.id !== tool.id));
                            }}
                            className="text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 px-2 py-1 rounded-md flex items-center gap-1 transition-colors"
                          >
                            <Unlink size={12} /> Remove
                          </button>
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
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{tool.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Connection" : "Add Connection"}</h2>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Connection Name</label>
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. My Llama3 Local Server"
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Provider Type</label>
                  <select 
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as AIProviderType)}
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  >
                    <option value="openai-compatible">Universal (OpenAI-Compatible / Local)</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google Gemini</option>
                  </select>
                </div>

                {provider === 'openai-compatible' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Base URL</label>
                    <input 
                      type="url" 
                      required
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium mb-1">API Key {provider === 'openai-compatible' && '(Optional for Local)'}</label>
                  <input 
                    type="password" 
                    required={provider !== 'openai-compatible'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Save Connection
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
