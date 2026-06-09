"use client";

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, PlaygroundAgent } from '@/types/playground';
import { Send, Bot, User, Settings2, Loader2, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import DebuggerPanel from '@/components/canvas/DebuggerPanel';
import { StreamLog } from '@/hooks/useDeployBlueprint';

interface PlaygroundClientProps {
  blueprint: any;
}

export function PlaygroundClient({ blueprint }: PlaygroundClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'agent', content: `Hello! I am ready to assist you. My active agents are: ${blueprint.agents.map((a: any) => a.name).join(', ') || 'None'}. What would you like to build today?`, timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [logs, setLogs] = useState<StreamLog[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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

  // Clean up SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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
    setLogs([]); // Clear previous logs for the new turn
    
    const agentMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: agentMsgId,
      role: 'agent',
      content: '',
      timestamp: new Date()
    }]);

    try {
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
        if (universalConn.baseUrl) headers['x-local-ai-url'] = universalConn.baseUrl;
      }
      if (anthropicConn) headers['x-anthropic-api-key'] = anthropicConn.apiKey || '';
      if (googleConn) headers['x-google-api-key'] = googleConn.apiKey || '';

      const chatHistory = [...messages, newUserMsg].map(m => ({
        role: m.role,
        content: m.content
      }));

      // 1. Send task to Celery
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/agent/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          blueprint,
          messages: chatHistory
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to start chat task: ${errText}`);
      }

      const data = await response.json();
      const taskId = data.task_id;
      setCurrentTaskId(taskId);

      // 2. Open SSE stream to get traces & final answer
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`${backendUrl}/api/agent/stream/${taskId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const eventData = JSON.parse(event.data);
        const time = new Date().toLocaleTimeString();
        
        setLogs(prev => [...prev, { 
          status: eventData.status, 
          message: eventData.message, 
          data: eventData.data, 
          time 
        }]);

        if (eventData.status === 'PROCESSING') {
          // Optional: update agent UI to show thinking state
        } else if (eventData.status === 'COMPLETED') {
          const finalReply = eventData.data?.reply || "Done.";
          setMessages(prev => prev.map(msg => 
            msg.id === agentMsgId 
              ? { ...msg, content: finalReply }
              : msg
          ));
          setIsStreaming(false);
          eventSource.close();
        } else if (eventData.status === 'ERROR') {
          setMessages(prev => prev.map(msg => 
            msg.id === agentMsgId 
              ? { ...msg, content: `[Error: ${eventData.message}]` }
              : msg
          ));
          setIsStreaming(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setIsStreaming(false);
        eventSource.close();
      };

    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages(prev => prev.map(msg => 
        msg.id === agentMsgId 
          ? { ...msg, content: `[Connection Error: ${error.message}]` }
          : msg
      ));
      setIsStreaming(false);
    }
  };

  const handleReset = () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setMessages([
      { id: '1', role: 'agent', content: `Hello! I am ready to assist you. My active agents are: ${blueprint.agents.map((a: any) => a.name).join(', ') || 'None'}. What would you like to build today?`, timestamp: new Date() }
    ]);
    setLogs([]);
    setCurrentTaskId(null);
    setIsStreaming(false);
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Sidebar for Agents */}
      <div className="w-64 border-r bg-muted/10 flex flex-col p-4 shrink-0">
        <h2 className="font-semibold mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><Bot className="w-5 h-5" /> Agents</div>
          <button onClick={handleReset} className="text-muted-foreground hover:text-foreground p-1" title="Reset Chat">
            <RefreshCw className="w-4 h-4" />
          </button>
        </h2>
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

      {/* Main Chat Area (Split Pane) */}
      <div className="flex-1 flex w-full h-full overflow-hidden">
        
        {/* Left Pane: Chat Window */}
        <div className="flex-1 flex flex-col h-full relative min-w-[400px]">
          <div className="p-4 border-b flex justify-between items-center shadow-sm z-10 bg-background/80 backdrop-blur-md">
            <h2 className="font-semibold">{activeAgents.find(a => a.id === selectedAgent)?.name || 'Multi-Agent Team'}</h2>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-4 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={`p-4 rounded-lg shadow-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border'} ${!msg.content && isStreaming ? 'animate-pulse min-w-[60px]' : ''}`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content?.trim() || (isStreaming && msg.role === 'agent' ? 'Thinking...' : '')}
                  </p>
                  <p suppressHydrationWarning className={`text-[10px] mt-2 opacity-70 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-background/80 backdrop-blur-md border-t">
            <div className="max-w-4xl mx-auto relative flex items-center">
              <input 
                type="text" 
                placeholder="Message your agent team..."
                className="w-full pl-4 pr-12 py-4 border rounded-xl bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isStreaming}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="absolute right-2 p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane: Debugger Panel */}
        <div className="w-[450px] border-l bg-[#0F172A] flex flex-col shrink-0 h-full p-4 relative hidden lg:flex">
          {currentTaskId ? (
            <DebuggerPanel 
              taskId={currentTaskId} 
              logs={logs} 
              onClose={() => {}}
              agents={blueprint.agents}
              isOverlay={false}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
              <Bot className="w-16 h-16 opacity-20" />
              <p className="text-sm">Execution traces will appear here.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
