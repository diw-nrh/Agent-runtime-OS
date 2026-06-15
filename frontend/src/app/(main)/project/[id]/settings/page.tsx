"use client";

import { useEffect, useState, use } from "react";
import { useSettingsStore, AIConnection, AIProviderType, ExecutionSettings } from "@/store/settingsStore";
import { McpTool, LinkedMcpTool, CustomMcpTool } from "@/types";
import { Server, Plus, Trash2, Edit2, ShieldCheck, Cpu, Package, Link2, Unlink, Wrench, Globe, AlertTriangle, Settings2, Save, Activity, Loader2, CheckCircle2, XCircle, Users, Copy, Check } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/number-input";
import { getBackendUrl } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { toast } = useToast();
  
  const { getProjectSettings, addConnection, updateConnection, deleteConnection, linkTool, unlinkTool, addCustomTool, updateCustomTool, deleteCustomTool, updateExecutionSettings } = useSettingsStore();
  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [linkedTools, setLinkedTools] = useState<LinkedMcpTool[]>([]);
  const [customTools, setCustomTools] = useState<CustomMcpTool[]>([]);
  const [executionSettings, setExecutionSettings] = useState<ExecutionSettings>({
    enableGlobalLimits: true,
    maxTokensPerRun: 100000,
    maxIterations: 25,
    enableFaultTolerance: false,
    maxToolCalls: 1,
    maxHandoffBounces: 1,
    maxMemoryMessages: 10
  });
  const [availableTools, setAvailableTools] = useState<McpTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<AIProviderType>("openai-compatible");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  // Collaborators Tab State
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [copiedWorkspaceId, setCopiedWorkspaceId] = useState(false);

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

    // Fetch blueprint workspace mapping
    fetch(`/api/blueprints/${projectId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.blueprint) {
          setWorkspaceId(data.blueprint.workspaceId);
          setWorkspaceOwnerId(data.blueprint.workspace?.ownerId || null);
        }
      })
      .catch(console.error);
  }, [projectId, getProjectSettings, showModal]);

  const fetchMembers = async (wId: string) => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/workspaces/${wId}/members`);
      const data = await res.json();
      if (data.success && data.members) {
        setMembers(data.members);
      } else {
        console.error("Failed to load members:", data.error || data.message);
      }
    } catch (err) {
      console.error("Failed to fetch workspace members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchMembers(workspaceId);
    }
  }, [workspaceId]);

  const [showCustomToolModal, setShowCustomToolModal] = useState(false);
  const [editingCustomToolId, setEditingCustomToolId] = useState<string | null>(null);
  
  // Custom Tool Form State
  const [ctName, setCtName] = useState("");
  const [ctDesc, setCtDesc] = useState("");
  const [ctType, setCtType] = useState<'stdio' | 'sse'>('stdio');
  const [ctUrl, setCtUrl] = useState("");
  const [ctCommand, setCtCommand] = useState("");
  const [ctArgs, setCtArgs] = useState("");

  const [testStatus, setTestStatus] = useState<Record<string, 'testing' | 'success' | 'error'>>({});
  const [modalTestStatus, setModalTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const testMcpConnection = async (type: 'stdio'|'sse', url: string, command: string, args: string[], toolId?: string) => {
    try {
      if (toolId) {
        setTestStatus(prev => ({ ...prev, [toolId]: 'testing' }));
      } else {
        setModalTestStatus('testing');
      }
      
      const res = await fetch(`${getBackendUrl()}/api/mcp/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, url: type === 'sse' ? url : undefined, command: type === 'stdio' ? command : undefined, args: type === 'stdio' ? args : undefined })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (toolId) setTestStatus(prev => ({ ...prev, [toolId]: 'error' }));
        else setModalTestStatus('error');
        toast.error("Connection Failed: " + (data.detail || "Unknown error"));
      } else {
        if (toolId) {
          setTestStatus(prev => ({ ...prev, [toolId]: 'success' }));
          setTimeout(() => setTestStatus(prev => { const n = {...prev}; delete n[toolId]; return n; }), 3000);
        } else {
          setModalTestStatus('success');
          setTimeout(() => setModalTestStatus('idle'), 3000);
        }
        if (data.tools && Array.isArray(data.tools)) {
          const toolsStr = data.tools.map((t: { name: string }) => `- ${t.name}`).join('\n');
          toast.success(`Success! Found ${data.tools.length} tools:\n${toolsStr}`);
        }
      }
    } catch (err) {
      if (toolId) setTestStatus(prev => ({ ...prev, [toolId]: 'error' }));
      else setModalTestStatus('error');
      toast.error("Failed to reach backend to test MCP connection.");
    }
  };

  const [connTestStatus, setConnTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connTestModel, setConnTestModel] = useState("");

  const testAiConnection = async () => {
    if (!connTestModel) {
      toast.error("Please enter a Test Model Name before testing.");
      return;
    }
    
    // Validate inputs based on provider
    if ((provider === 'openai-compatible' || provider === 'local') && !baseUrl) {
      toast.error("Base URL is required for this provider.");
      return;
    }
    
    if (provider !== 'openai-compatible' && provider !== 'local' && !apiKey) {
      toast.error("API Key is required for this provider.");
      return;
    }
    
    try {
      setConnTestStatus('testing');
      const res = await fetch(`${getBackendUrl()}/api/agent/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider, 
          model: connTestModel,
          api_key: apiKey,
          base_url: baseUrl 
        })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setConnTestStatus('error');
        toast.error("Connection Failed: " + (data.detail || "Unknown error"));
      } else {
        setConnTestStatus('success');
        setTimeout(() => setConnTestStatus('idle'), 3000);
        toast.success(`Success! Model responded: "${data.message}"`);
      }
    } catch (err) {
      setConnTestStatus('error');
      toast.error("Failed to reach backend to test AI connection.");
    }
  };

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
    
    toast.success("บันทึกข้อมูลเครื่องมือสำเร็จแล้ว");
    setCustomTools(getProjectSettings(projectId).customTools || []);
    setShowCustomToolModal(false);
  };

  const handleDeleteCustomTool = (id: string) => {
    if (confirm("Delete this custom tool?")) {
      deleteCustomTool(projectId, id);
      toast.success("ลบเครื่องมือสำเร็จแล้ว");
      setCustomTools(getProjectSettings(projectId).customTools || []);
    }
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !inviteEmail) return;

    setInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Collaborator invited successfully!");
        setInviteEmail("");
        fetchMembers(workspaceId);
      } else {
        toast.error(data.error || "Failed to invite collaborator");
      }
    } catch (err) {
      toast.error("Error inviting collaborator.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!workspaceId) return;
    if (!confirm("Are you sure you want to remove this collaborator?")) return;

    setRemovingMemberId(userId);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members?userId=${userId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Collaborator removed successfully!");
        fetchMembers(workspaceId);
      } else {
        toast.error(data.error || "Failed to remove collaborator");
      }
    } catch (err) {
      toast.error("Error removing collaborator.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      toast.success("คัดลอก Workspace ID เรียบร้อยแล้ว");
      setCopiedWorkspaceId(true);
      setTimeout(() => setCopiedWorkspaceId(false), 2000);
    } catch (err) {
      toast.error("ไม่สามารถคัดลอกได้");
      console.error("Fallback copy failed:", err);
    }
    document.body.removeChild(textArea);
  };

  const handleCopyWorkspaceId = () => {
    if (!workspaceId) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(workspaceId)
        .then(() => {
          toast.success("คัดลอก Workspace ID เรียบร้อยแล้ว");
          setCopiedWorkspaceId(true);
          setTimeout(() => setCopiedWorkspaceId(false), 2000);
        })
        .catch(() => fallbackCopyText(workspaceId));
    } else {
      fallbackCopyText(workspaceId);
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
    setConnTestStatus('idle');
    setConnTestModel("");
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
    
    toast.success("บันทึกข้อมูลผู้ให้บริการ AI สำเร็จแล้ว");
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this connection? Workflows using it will fail.")) {
      deleteConnection(projectId, id);
      toast.success("ลบผู้ให้บริการ AI สำเร็จแล้ว");
      setConnections(connections.filter(c => c.id !== id));
    }
  };

  const [activeTab, setActiveTab] = useState<'connections' | 'tools' | 'limits' | 'collaborators'>('connections');

  const handleSaveExecutionSettings = () => {
    updateExecutionSettings(projectId, executionSettings);
    toast.success("บันทึกการตั้งค่าขีดจำกัดการรันสำเร็จแล้ว");
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

          <button 
            className={`px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${activeTab === 'collaborators' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab('collaborators')}
          >
            <Users size={16} /> Collaborators
            {activeTab === 'collaborators' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-md" />}
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
            <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-xl text-muted-foreground glass-panel">
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
                <div key={conn.id} className="glass-card rounded-xl overflow-hidden flex flex-col group glass-hover">
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
                onClick={() => setExecutionSettings({ enableGlobalLimits: true, maxTokensPerRun: 100000, maxIterations: 25, enableFaultTolerance: false, maxToolCalls: 1, maxHandoffBounces: 1, maxMemoryMessages: 10 })}
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
            <div className="glass-panel rounded-xl p-6 shadow-sm">
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
                  <NumberInput 
                    value={executionSettings.maxTokensPerRun}
                    onChange={(val) => setExecutionSettings({ ...executionSettings, maxTokensPerRun: Number(val) || 0 })}
                    className="w-full text-base"
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
                  <NumberInput 
                    value={executionSettings.maxIterations}
                    onChange={(val) => setExecutionSettings({ ...executionSettings, maxIterations: Number(val) || 0 })}
                    className="w-full text-base"
                    min={1}
                    max={100}
                    disabled={!executionSettings.enableGlobalLimits}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Maximum number of thought-tool loops before Agent gives up.
                  </p>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold">
                      Max Calls Per Tool <span className="text-muted-foreground font-normal ml-1">(Default: 1)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Infinite</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={executionSettings.maxToolCalls === -1}
                          onChange={(e) => setExecutionSettings({ 
                            ...executionSettings, 
                            maxToolCalls: e.target.checked ? -1 : 1 
                          })}
                          disabled={!executionSettings.enableGlobalLimits}
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  </div>
                  <NumberInput 
                    value={executionSettings.maxToolCalls === -1 ? '' : (executionSettings.maxToolCalls ?? 1)}
                    onChange={(val) => setExecutionSettings({ ...executionSettings, maxToolCalls: Number(val) || 1 })}
                    className="w-full text-base"
                    min={1}
                    max={100}
                    disabled={!executionSettings.enableGlobalLimits || executionSettings.maxToolCalls === -1}
                    placeholder={executionSettings.maxToolCalls === -1 ? "Unlimited" : "Enter max tool calls"}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    How many times each Agent can call a tool per run. Turn on Infinite for unlimited calls.
                  </p>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold">
                      Max Handoff Bounces <span className="text-muted-foreground font-normal ml-1">(Default: 1)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Infinite</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={executionSettings.maxHandoffBounces === -1}
                          onChange={(e) => setExecutionSettings({ 
                            ...executionSettings, 
                            maxHandoffBounces: e.target.checked ? -1 : 1 
                          })}
                          disabled={!executionSettings.enableGlobalLimits}
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  </div>
                  <NumberInput 
                    value={executionSettings.maxHandoffBounces === -1 ? '' : (executionSettings.maxHandoffBounces ?? 1)}
                    onChange={(val) => setExecutionSettings({ ...executionSettings, maxHandoffBounces: Number(val) || 1 })}
                    className="w-full text-base"
                    min={1}
                    max={100}
                    disabled={!executionSettings.enableGlobalLimits || executionSettings.maxHandoffBounces === -1}
                    placeholder={executionSettings.maxHandoffBounces === -1 ? "Unlimited" : "Enter max handoff bounces"}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    How many times an Agent can delegate tasks to another Agent. Turn on Infinite for unlimited bounces.
                  </p>
                </div>
                

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold">
                      Max Memory Messages <span className="text-muted-foreground font-normal ml-1">(Default: 10)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Infinite</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={executionSettings.maxMemoryMessages === -1}
                          onChange={(e) => setExecutionSettings({ 
                            ...executionSettings, 
                            maxMemoryMessages: e.target.checked ? -1 : 10 
                          })}
                          disabled={!executionSettings.enableGlobalLimits}
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  </div>
                  <NumberInput 
                    value={executionSettings.maxMemoryMessages === -1 ? '' : (executionSettings.maxMemoryMessages ?? 10)}
                    onChange={(val) => {
                      const numVal = Number(val);
                      setExecutionSettings({ ...executionSettings, maxMemoryMessages: isNaN(numVal) ? 0 : numVal });
                    }}
                    className="w-full text-base"
                    min={0}
                    max={100}
                    disabled={!executionSettings.enableGlobalLimits || executionSettings.maxMemoryMessages === -1}
                    placeholder={executionSettings.maxMemoryMessages === -1 ? "Unlimited" : "Enter max memory messages"}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    How many past messages the Agent remembers per turn. Turn on Infinite to remember everything.
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

      {activeTab === 'collaborators' && (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Collaborators</h2>
              <p className="text-muted-foreground mt-2 leading-relaxed text-sm">
                Manage members and access permissions for this workspace. Share your Workspace ID to allow collaborators to join your projects.
              </p>
              {workspaceId && (
                <div className="flex items-center gap-2 mt-3 p-2.5 bg-white/5 border border-white/10 rounded-lg font-mono text-xs text-muted-foreground select-all w-fit">
                  <span className="text-foreground font-semibold">Workspace ID:</span> {workspaceId}
                  <button
                    onClick={handleCopyWorkspaceId}
                    className="p-1 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded transition-colors ml-1"
                    title="Copy Workspace ID"
                  >
                    {copiedWorkspaceId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in duration-100" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Invite Form */}
            <div className="glass-panel rounded-xl p-6 shadow-sm border border-white/10 bg-white/5">
              <h3 className="font-semibold text-lg text-foreground mb-4">Invite Collaborator</h3>
              <form onSubmit={handleInviteCollaborator} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-semibold text-foreground mb-2">User Email</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="collaborator@example.com"
                    className="w-full px-3 py-2 border border-white/15 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm placeholder:text-muted-foreground"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <label className="block text-sm font-semibold text-foreground mb-2">Role</label>
                  <Select
                    value={inviteRole}
                    onChange={(val) => setInviteRole(val as 'MEMBER' | 'ADMIN')}
                    options={[
                      { value: "MEMBER", label: "Member" },
                      { value: "ADMIN", label: "Admin" }
                    ]}
                  />
                </div>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-md font-medium hover:bg-primary/90 transition-all shadow-sm shrink-0 whitespace-nowrap text-sm disabled:opacity-50"
                >
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Invite
                </button>
              </form>
            </div>

            {/* Members List */}
            <div className="glass-panel rounded-xl overflow-hidden border border-white/10 bg-white/5 shadow-sm">
              <div className="p-6 border-b border-white/10">
                <h3 className="font-semibold text-lg text-foreground">Current Members</h3>
              </div>
              {loadingMembers ? (
                <div className="p-8 text-center text-muted-foreground flex justify-center items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No collaborators added yet.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate text-foreground">
                            {member.user.name || "Unnamed User"}
                          </p>
                          {workspaceOwnerId === member.user.id && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/25">
                              Owner
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${
                            member.status === 'ACTIVE' 
                              ? 'bg-green-500/10 text-green-500 border-green-500/25' 
                              : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/25'
                          }`}>
                            {member.status.toLowerCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {member.user.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-medium bg-white/5 border border-white/10 px-2.5 py-1 rounded-md uppercase text-foreground">
                          {member.role}
                        </span>
                        {workspaceOwnerId !== member.user.id && (
                          <button
                            onClick={() => handleRemoveCollaborator(member.user.id)}
                            disabled={removingMemberId === member.user.id}
                            className="p-1.5 text-muted-foreground hover:text-destructive rounded-md transition-colors disabled:opacity-50"
                            title="Remove collaborator"
                          >
                            {removingMemberId === member.user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCustomToolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-lg border overflow-hidden my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{editingCustomToolId ? "Edit MCP Tool" : "Add Local MCP Tool"}</h2>
              
              <form onSubmit={handleSaveCustomTool} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tool Name</label>
                  <input 
                    type="text" 
                    required
                    value={ctName}
                    onChange={(e) => setCtName(e.target.value)}
                    placeholder="e.g. Local Stock Analyzer"
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                  <input 
                    type="text" 
                    value={ctDesc}
                    onChange={(e) => setCtDesc(e.target.value)}
                    placeholder="Briefly describe what this server does"
                    className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Transport Type</label>
                  <Select 
                    value={ctType}
                    onChange={(val) => setCtType(val as 'stdio' | 'sse')}
                    options={[
                      { value: "stdio", label: "Stdio (Command Line)" },
                      { value: "sse", label: "SSE (HTTP URL)" }
                    ]}
                  />
                </div>

                {ctType === 'stdio' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1">Command</label>
                      <input 
                        type="text" 
                        required
                        value={ctCommand}
                        onChange={(e) => setCtCommand(e.target.value)}
                        placeholder="e.g. npx or python"
                        className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Arguments (Space separated)</label>
                      <input 
                        type="text" 
                        value={ctArgs}
                        onChange={(e) => setCtArgs(e.target.value)}
                        placeholder="e.g. -y @modelcontextprotocol/server-postgres"
                        className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">If your paths contain spaces, ensure they are properly escaped.</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1">SSE URL</label>
                    <input 
                      type="url" 
                      required
                      value={ctUrl}
                      onChange={(e) => setCtUrl(e.target.value)}
                      placeholder="http://localhost:3000/sse"
                      className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                    />
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
                  <button
                    type="button"
                    onClick={() => setShowCustomToolModal(false)}
                    className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Save MCP Tool
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
                  <Select 
                    value={provider}
                    onChange={(val) => {
                      const newProvider = val as AIProviderType;
                      setProvider(newProvider);
                      if (newProvider === 'local') {
                        if (!baseUrl || baseUrl === 'https://api.openai.com/v1') setBaseUrl('http://localhost:1234/v1');
                        if (!apiKey) setApiKey('local');
                      } else if (newProvider === 'openai-compatible') {
                        if (baseUrl === 'http://localhost:1234/v1') setBaseUrl('https://api.openai.com/v1');
                      }
                    }}
                    options={[
                      { value: "openai-compatible", label: "Universal (OpenAI-Compatible)" },
                      { value: "local", label: "Local (LM Studio, Ollama, vLLM)" },
                      { value: "anthropic", label: "Anthropic" },
                      { value: "google", label: "Google Gemini" }
                    ]}
                  />
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

                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Test Connection</label>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={connTestModel}
                      onChange={(e) => setConnTestModel(e.target.value)}
                      placeholder="Test Model Name (e.g. gpt-4o-mini)"
                      className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={testAiConnection}
                      disabled={connTestStatus === 'testing' || !connTestModel}
                      className={`px-4 py-2 text-sm border rounded-md transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 ${
                        connTestStatus === 'success' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20' :
                        connTestStatus === 'error' ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20' :
                        'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20'
                      }`}
                    >
                      {connTestStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                       connTestStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                       connTestStatus === 'error' ? <XCircle className="w-4 h-4" /> :
                       <Activity className="w-4 h-4" />}
                      {connTestStatus === 'success' ? 'Success' : connTestStatus === 'error' ? 'Failed' : 'Test'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-4">
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
