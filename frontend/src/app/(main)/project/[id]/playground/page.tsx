"use client";

import { useState } from 'react';
import { ChatMessage, PlaygroundAgent } from '@/types/playground';
import { Send, Bot, User, Settings2 } from 'lucide-react';

const mockAgents: PlaygroundAgent[] = [
  { id: '1', name: 'Code Reviewer Pro', status: 'online' },
  { id: '2', name: 'Data Analyst Agent', status: 'offline' },
];

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'agent', content: 'Hello! I am ready to assist you. What would you like to build today?', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(mockAgents[0]?.id || '');

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    
    // Mock response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: `I received your message: "${newUserMsg.content}". I am currently in a simulated environment!`,
        timestamp: new Date()
      }]);
    }, 1000);
  };

  return (
    <div className="flex h-full w-full">
      {/* Sidebar for Agents */}
      <div className="w-64 border-r bg-muted/10 flex flex-col p-4">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Bot className="w-5 h-5" /> Active Agents</h2>
        <div className="space-y-2 flex-1">
          {mockAgents.map(agent => (
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
      <div className="flex-1 flex flex-col h-full bg-background">
        <div className="p-4 border-b flex justify-between items-center shadow-sm z-10">
          <h2 className="font-semibold">{mockAgents.find(a => a.id === selectedAgent)?.name || 'Select an Agent'}</h2>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-4 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`p-4 rounded-lg shadow-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-2 opacity-70 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-card border-t">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input 
              type="text" 
              placeholder="Message your agent..."
              className="w-full pl-4 pr-12 py-3 border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-2 p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
