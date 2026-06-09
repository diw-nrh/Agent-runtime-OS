"use client";

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, PlaygroundAgent } from '@/types/playground';
import { Send, Bot, User, Settings2, Loader2 } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';

interface PlaygroundClientProps {
  blueprint: any;
}

export function PlaygroundClient({ blueprint }: PlaygroundClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'agent', content: `Hello! I am ready to assist you. My active agents are: ${blueprint.agents.map((a: any) => a.name).join(', ') || 'None'}. What would you like to build today?`, timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Using getProjectSettings inside handleSend instead
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeAgents: PlaygroundAgent[] = blueprint.agents.map((a: any) => ({
    id: a.id,
    name: a.name,
    status: 'online'
  }));

  const [selectedAgent, setSelectedAgent] = useState(activeAgents[0]?.id || '');

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsStreaming(true);
    
    // Add an empty agent message to hold the stream
    const agentMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: agentMsgId,
      role: 'agent',
      content: '',
      timestamp: new Date()
    }]);

    try {
      // Build Headers for BYOK
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      const { getProjectSettings } = useSettingsStore.getState();
      const { connections } = getProjectSettings(blueprint.id);
      
      const universalConn = connections.find(c => c.provider === 'openai-compatible');
      const anthropicConn = connections.find(c => c.provider === 'anthropic');
      const googleConn = connections.find(c => c.provider === 'google');
      
      if (universalConn) {
        headers['x-openai-api-key'] = universalConn.apiKey || '';
        if (universalConn.baseUrl) {
          headers['x-local-ai-url'] = universalConn.baseUrl;
        }
      }

      // Add Anthropic and Google headers if the backend supports them in the future
      if (anthropicConn) headers['x-anthropic-api-key'] = anthropicConn.apiKey || '';
      if (googleConn) headers['x-google-api-key'] = googleConn.apiKey || '';

      const chatHistory = [...messages, newUserMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch('http://localhost:8000/api/agent/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          blueprint,
          messages: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        // The server sends SSE formatted data: `data: {"status":"PROCESSING", "chunk": "..."}\n\n`
        const lines = chunkText.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.status === 'PROCESSING' && data.chunk) {
                setMessages(prev => prev.map(msg => 
                  msg.id === agentMsgId 
                    ? { ...msg, content: msg.content + data.chunk }
                    : msg
                ));
              } else if (data.status === 'ERROR') {
                setMessages(prev => prev.map(msg => 
                  msg.id === agentMsgId 
                    ? { ...msg, content: msg.content + `\n\n[Error: ${data.message}]` }
                    : msg
                ));
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", dataStr);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages(prev => prev.map(msg => 
        msg.id === agentMsgId 
          ? { ...msg, content: msg.content + `\n\n[Connection Error: ${error.message}]` }
          : msg
      ));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* Sidebar for Agents */}
      <div className="w-64 border-r bg-muted/10 flex flex-col p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Bot className="w-5 h-5" /> Active Agents</h2>
        <div className="space-y-2 flex-1 overflow-y-auto">
          {activeAgents.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No agents deployed.</p>
          )}
          {activeAgents.map(agent => (
            <button 
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-md transition-colors text-left ${selectedAgent === agent.id ? 'bg-primary/10 border-primary/20 border' : 'hover:bg-muted border border-transparent'}`}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {agent.name.charAt(0)}
                </div>
                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${agent.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{agent.status}</p>
              </div>
            </button>
          ))}
        </div>
        
        <div className="pt-4 border-t">
          <button className="w-full flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="w-4 h-4" /> Manage Agents
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-background relative">
        <div className="p-4 border-b flex justify-between items-center shadow-sm z-10 bg-background">
          <h2 className="font-semibold">{activeAgents.find(a => a.id === selectedAgent)?.name || 'Multi-Agent Team'}</h2>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-4 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`p-4 rounded-lg shadow-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border'} ${!msg.content && isStreaming ? 'animate-pulse min-w-[60px]' : ''}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content || (isStreaming && msg.role === 'agent' ? '...' : '')}</p>
                <p className={`text-[10px] mt-2 opacity-70 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-card border-t">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input 
              type="text" 
              placeholder="Message your agent team..."
              className="w-full pl-4 pr-12 py-3 border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isStreaming}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
