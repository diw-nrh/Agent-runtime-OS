"use client";

import { useEffect, useState, use } from "react";
import { useSettingsStore, AIConnection, AIProviderType } from "@/store/settingsStore";
import { Server, Plus, Trash2, Edit2, ShieldCheck, Cpu } from "lucide-react";

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  
  const { getProjectSettings, addConnection, updateConnection, deleteConnection } = useSettingsStore();
  const [connections, setConnections] = useState<AIConnection[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<AIProviderType>("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    // Load connections
    const projSettings = getProjectSettings(projectId);
    setConnections(projSettings.connections || []);
  }, [projectId, getProjectSettings, showModal]); // Reload when modal closes

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
      setProvider("openai");
      setApiKey("");
      setBaseUrl("http://localhost:11434");
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
        apiKey: provider !== 'local' ? apiKey : undefined,
        baseUrl: provider === 'local' ? baseUrl : undefined
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

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full h-full">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight">AI Connections</h1>
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
                      conn.provider === 'openai' ? 'bg-green-100 text-green-700' :
                      conn.provider === 'groq' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {conn.provider === 'local' ? <Server className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
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
                  {conn.provider === 'local' ? conn.baseUrl : 'API Key Securely Stored'}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

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
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                    <option value="local">Local AI</option>
                  </select>
                </div>

                {provider === 'local' ? (
                  <div>
                    <label className="block text-sm font-medium mb-1">Base URL</label>
                    <input 
                      type="url" 
                      required
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1">API Key</label>
                    <input 
                      type="password" 
                      required
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={provider === 'openai' ? "sk-..." : "gsk_..."}
                      className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm"
                    />
                  </div>
                )}

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
