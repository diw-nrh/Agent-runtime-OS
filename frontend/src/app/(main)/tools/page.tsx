'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, ChevronRight, Server, Search } from 'lucide-react';
import { McpToolConfig } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';

type MarketplaceMcpTool = {
  id: string;
  name: string;
  description: string | null;
  author: { name: string | null; email: string };
  versions: { version: string; config: McpToolConfig; createdAt: string }[];
  createdAt: string;
};

export default function McpRegistryPage() {
  const [tools, setTools] = useState<MarketplaceMcpTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formUrl, setFormUrl] = useState('');

  const fetchTools = async () => {
    try {
      const res = await fetch('/api/mcp-registry');
      const data = await res.json();
      if (data.success) setTools(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      name: formName,
      description: formDesc,
      authorId: "user-uuid-here", // API will fallback to a real user
      config: {
        type: 'sse',
        url: formUrl
      }
    };
    
    try {
      const res = await fetch('/api/mcp-registry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        setFormName('');
        setFormDesc('');
        setFormUrl('');
        fetchTools(); // Refresh list
      } else {
        alert("Error publishing: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to publish tool.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-muted/20">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MCP Tools</h1>
            <p className="text-muted-foreground mt-2">Discover, manage, and publish external Model Context Protocol tools.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Publish New Tool
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="text" 
            placeholder="Search for tools, databases, APIs..." 
            className="w-full pl-10 pr-4 py-3 rounded-lg border bg-card shadow-sm outline-none focus:border-primary/50"
          />
        </div>

        {/* Tools Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-pulse flex items-center gap-2"><Server className="text-muted-foreground" /> Loading Registry...</div></div>
        ) : tools.length === 0 ? (
          <div className="text-center py-20 border rounded-lg bg-card/50 border-dashed">
            <Package size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No tools found</h3>
            <p className="text-muted-foreground text-sm">Be the first to publish a custom MCP tool!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map(tool => (
              <div key={tool.id} className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow group flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-primary/10 p-2.5 rounded-lg text-primary">
                    <Package size={24} />
                  </div>
                  <span className="text-[10px] font-mono bg-muted px-2 py-1 rounded-full text-muted-foreground border">
                    v{tool.versions[0]?.version || '0.0.0'}
                  </span>
                </div>
                
                <h3 className="font-semibold text-lg mb-1">{tool.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                  {tool.description || 'No description provided.'}
                </p>
                
                <div className="pt-4 border-t flex items-center justify-between mt-auto">
                  <div className="text-xs text-muted-foreground">
                    By {tool.author?.name || 'Unknown'}
                  </div>
                  <button className="text-xs font-medium text-primary flex items-center gap-1 group-hover:underline">
                    View Details <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Publish Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-2xl overflow-hidden border">
            <div className="px-6 py-4 border-b bg-muted/30">
              <h2 className="text-lg font-semibold">Publish Custom MCP</h2>
            </div>
            
            <form onSubmit={handlePublish} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tool Name</label>
                <input required value={formName} onChange={e => setFormName(e.target.value)} type="text" placeholder="e.g. Postgres Connector" className="w-full p-2 text-sm border rounded-md outline-none focus:border-primary/50" />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="What does this tool do?" className="w-full p-2 text-sm border rounded-md outline-none focus:border-primary/50 resize-none h-20" />
              </div>
              
              <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 mb-4">
                <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
                  <Server size={14} /> SSE Transport Only
                </div>
                <p className="text-xs text-muted-foreground">
                  For security reasons, the Global Marketplace only supports hosted MCP servers via SSE (Server-Sent Events). 
                  Local execution via `stdio` is disabled.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Endpoint URL</label>
                <input required value={formUrl} onChange={e => setFormUrl(e.target.value)} type="url" placeholder="https://your-mcp-server.com/sse" className="w-full p-2 text-sm border rounded-md font-mono outline-none focus:border-primary/50" />
              </div>

              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-md text-xs mt-4 border border-blue-500/20">
                <strong>Version 1.0.0</strong> will be automatically assigned.
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-md hover:bg-muted font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 font-medium transition-colors">Publish</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
