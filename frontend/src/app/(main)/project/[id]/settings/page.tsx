"use client";

import { useEffect, useState, use } from "react";
import { useSettingsStore, AIConnection, AIProviderType, CustomMcpTool, ExecutionSettings } from "@/store/settingsStore";
import { Server, Plus, Trash2, Edit2, ShieldCheck, Cpu, Package, Link2, Unlink, Wrench, Globe, AlertTriangle, Settings2, Save } from "lucide-react";

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  
  const { getProjectSettings, addConnection, updateConnection, deleteConnection, linkTool, unlinkTool, addCustomTool, updateCustomTool, deleteCustomTool, updateExecutionSettings } = useSettingsStore();
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [linkedTools, setLinkedTools] = useState<any[]>([]);
  const [customTools, setCustomTools] = useState<CustomMcpTool[]>([]);
  const [executionSettings, setExecutionSettings] = useState<ExecutionSettings>({
    enableGlobalLimits: true,
    maxTokensPerRun: 100000,
    maxIterations: 25,
    enableFaultTolerance: false
  });
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
    // Load connections, linked tools, and execution settings
    const projSettings = getProjectSettings(projectId);
    setConnections(projSettings.connections || []);
    setLinkedTools(projSettings.linkedTools || []);
    setCustomTools(projSettings.customTools || []);
    if (projSettings.executionSettings) {
      setExecutionSettings(projSettings.executionSettings);
    }
    
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

  const getUniqueConnectionName = (baseName: string, currentId: string | null = null) => {
    let finalName = baseName.trim() || 'Unnamed Connection';
    const otherConns = currentId ? connections.filter(c => c.id !== currentId) : connections;
    
    if (otherConns.some(c => c.name === finalName)) {
      let counter = 1;
      let newName = `${finalName} (${counter})`;
      while (otherConns.some(c => c.name === newName)) {
        counter++;
        newName = `${finalName} (${counter})`;
      }
      return newName;
    }
    return finalName;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const uniqueName = getUniqueConnectionName(name, editingId);
    
    if (editingId) {
      updateConnection(projectId, editingId, { name: uniqueName, provider, apiKey, baseUrl });
    } else {
      const newConn: AIConnection = {
        id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        name: uniqueName,
        provider,
        apiKey: apiKey ? apiKey : undefined,
        baseUrl: (provider === 'openai-compatible' || provider === 'local') ? baseUrl : undefined
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

  const [activeTab, setActiveTab] = useState<'connections' | 'tools' | 'limits'>('connections');

  const handleSaveExecutionSettings = () => {
    updateExecutionSettings(projectId, executionSettings);
    alert("Execution settings saved successfully.");
  };

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
            className={`px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${activeTab === 'limits' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('limits')}
          >
            <Settings2 size={16} /> Execution & Limits
            {activeTab === 'limits' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-md" />}
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
                        conn.provider === 'local' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {(conn.provider === 'openai-compatible' || conn.provider === 'local') ? <Server className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
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
                    {(conn.provider === 'openai-compatible' || conn.provider === 'local') && conn.baseUrl ? conn.baseUrl : 'API Key Securely Stored'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'limits' && (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight">Execution & Limits</h2>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Control how agents run in this project. Set token budgets to prevent runaway costs, and configure fault tolerance.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button 
                onClick={() => setExecutionSettings({ enableGlobalLimits: true, maxTokensPerRun: 100000, maxIterations: 25, enableFaultTolerance: false })}
                className="flex items-center justify-center px-4 py-2.5 rounded-md font-medium bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm shrink-0 whitespace-nowrap text-sm"
              >
                Reset to Default
              </button>
              <button 
                onClick={handleSaveExecutionSettings}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium hover:bg-primary/90 transition-all shadow-sm shrink-0 whitespace-nowrap text-sm"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${executionSettings.enableGlobalLimits ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Enforce Global Limits</h3>
                    <p className="text-sm text-muted-foreground">Prevent AI from consuming too many tokens in a single execution run.</p>
                  </div>
                </div>
                <div className="ml-6 shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={executionSettings.enableGlobalLimits}
                      onChange={(e) => setExecutionSettings({ ...executionSettings, enableGlobalLimits: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
              
              <div className={`grid gap-6 md:grid-cols-2 transition-opacity ${executionSettings.enableGlobalLimits ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div>
                  <label className="block text-sm font-semibold mb-2">Max Tokens per Run <span className="text-muted-foreground font-normal ml-1">(Default: 100000)</span></label>
                  <input 
                    type="number" 
                    value={executionSettings.maxTokensPerRun}
                    onChange={(e) => setExecutionSettings({ ...executionSettings, maxTokensPerRun: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                    min={100}
                    step={1000}
                    disabled={!executionSettings.enableGlobalLimits}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Execution will be forcefully halted if this limit is reached.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Max Agent Iterations <span className="text-muted-foreground font-normal ml-1">(Default: 25)</span></label>
                  <input 
                    type="number" 
                    value={executionSettings.maxIterations}
                    onChange={(e) => setExecutionSettings({ ...executionSettings, maxIterations: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
                    min={1}
                    max={100}
                    disabled={!executionSettings.enableGlobalLimits}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Maximum number of thought-tool loops before Agent gives up.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-orange-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-100 text-orange-700 rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Error Handling Mode</h3>
                  <p className="text-sm text-muted-foreground">Determine how the Agent behaves when encountering a tool error.</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
                <div>
                  <h4 className="font-medium">Fault-Tolerant Mode (Self-Healing)</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    If enabled, the Agent will catch Tool Errors and try to fix the arguments or use a different tool. If disabled (Fail-Fast), the execution stops immediately on error.
                  </p>
                </div>
                <div className="ml-6 shrink-0">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={executionSettings.enableFaultTolerance}
                      onChange={(e) => setExecutionSettings({ ...executionSettings, enableFaultTolerance: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
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
                    onChange={(e) => {
                      const val = e.target.value as AIProviderType;
                      setProvider(val);
                      if (val === 'local') {
                        if (!baseUrl || baseUrl === 'https://api.openai.com/v1') setBaseUrl('http://localhost:1234/v1');
                        if (!apiKey) setApiKey('local');
                      } else if (val === 'openai-compatible') {
                        if (baseUrl === 'http://localhost:1234/v1') setBaseUrl('https://api.openai.com/v1');
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  >
                    <option value="openai-compatible">Universal (OpenAI-Compatible)</option>
                    <option value="local">Local (LM Studio, Ollama, vLLM)</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google Gemini</option>
                  </select>
                </div>

                {(provider === 'openai-compatible' || provider === 'local') && (
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
                  <label className="block text-sm font-medium mb-1">API Key {(provider === 'openai-compatible' || provider === 'local') && '(Optional for Local)'}</label>
                  <input 
                    type="password" 
                    required={provider !== 'openai-compatible' && provider !== 'local'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === 'local' ? "e.g. lm-studio" : "sk-..."}
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

    </div>
  );
}
