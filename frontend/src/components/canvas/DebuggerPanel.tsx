import { useState } from 'react';
import { X, Terminal, BrainCircuit, Wrench, MessageSquare, Loader2, Database, AlertTriangle, Code2, ShieldAlert, Check } from 'lucide-react';
import { StreamLog, TraceData } from '@/hooks/useDeployBlueprint';
import { getBackendUrl } from '@/lib/utils';

interface DebuggerPanelProps {
  taskId: string;
  logs: StreamLog[];
  onClose: () => void;
  agents?: {id: string, name: string}[];
  isOverlay?: boolean;
}

function TraceItem({ trace, renderIcon, formatContent, agents, isDeveloperMode, taskId }: { trace: StreamLog, renderIcon: (type: string) => React.ReactNode, formatContent: (type: string, content: unknown) => React.ReactNode, agents?: {id: string, name: string}[], isDeveloperMode: boolean, taskId: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const [actioned, setActioned] = useState<'approve' | 'reject' | null>(null);
  
  const isApproval = trace.status === 'TOOL_APPROVAL_REQUEST';
  const type = isApproval ? 'APPROVAL' : (trace.data?.type || 'MESSAGE');
  const rawAgentId = trace.data?.agentId || (isApproval ? 'Security' : 'Agent');
  const agent = agents?.find(a => a.id === rawAgentId);
  const resolvedName = agent ? (agent.name || (agent as { data?: { label?: string }, label?: string }).data?.label || (agent as { label?: string }).label || 'Agent') : null;
  const agentName = resolvedName ? `${agent!.id} ${resolvedName}` : (rawAgentId.length > 8 ? 'Agent' : rawAgentId);
  
  const rawContent = JSON.stringify(trace.data, null, 2);

  return (
    <div className="relative pl-6">
      <div className="absolute -left-3 top-0 bg-[#0F172A] border border-white/10 p-1 rounded-full z-10">
        {renderIcon(type)}
      </div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{agentName}</span>
          {isDeveloperMode && (
            <span className="text-[10px] text-gray-500 px-1.5 py-0.5 rounded bg-white/5 border border-white/5 uppercase tracking-wider">
              {type}
            </span>
          )}
        </div>
        {isDeveloperMode && (
          <button 
            onClick={() => setShowRaw(!showRaw)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${showRaw ? 'bg-primary/20 text-primary border-primary/30' : 'bg-transparent text-gray-500 border-white/10 hover:text-gray-300'}`}
          >
            {'{ }'} JSON
          </button>
        )}
      </div>
      <div className={`rounded-md p-3 text-xs overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar ${isDeveloperMode ? 'bg-white/5 border border-white/10 text-gray-300 font-mono' : 'bg-white/5 text-gray-200'} ${isApproval ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
        {showRaw && isDeveloperMode ? (
          <pre className="font-mono">{rawContent}</pre>
        ) : (
          <div className="whitespace-pre-wrap">{formatContent(type, isApproval ? trace.data : trace.data?.content)}</div>
        )}
        
        {isApproval && (
          <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
            {!actioned ? (
              <>
                <button 
                  onClick={async () => {
                    setActioned('approve');
                    await fetch(`${getBackendUrl()}/api/agent/approve`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ task_id: taskId, tool_name: (trace.data as unknown as Record<string, unknown>)?.toolName, action: 'approve' })
                    });
                  }}
                  className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Check size={14} /> Approve Execution
                </button>
                <button 
                  onClick={async () => {
                    setActioned('reject');
                    await fetch(`${getBackendUrl()}/api/agent/approve`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ task_id: taskId, tool_name: (trace.data as unknown as Record<string, unknown>)?.toolName, action: 'reject' })
                    });
                  }}
                  className="bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <X size={14} /> Reject
                </button>
              </>
            ) : (
              <span className={`text-xs font-semibold ${actioned === 'approve' ? 'text-green-400' : 'text-red-400'}`}>
                {actioned === 'approve' ? '✅ Approved' : '🚫 Rejected'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DebuggerPanel({ taskId, logs, onClose, agents, isOverlay = true }: DebuggerPanelProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'raw'>('timeline');
  const [isDeveloperMode, setIsDeveloperMode] = useState(false);

  // Filter traces
  const traces = logs.filter(l => l.status === 'TRACE_STEP' || l.status === 'TOOL_APPROVAL_REQUEST');
  const systemLogs = logs.filter(l => l.status !== 'TRACE_STEP' && l.status !== 'TOOL_APPROVAL_REQUEST');

  const renderIcon = (type: string) => {
    switch (type) {
      case 'THOUGHT': return <BrainCircuit size={16} className="text-blue-400" />;
      case 'TOOL_CALL': return <Wrench size={16} className="text-yellow-400" />;
      case 'TOOL_RESULT': return <Database size={16} className="text-purple-400" />;
      case 'MESSAGE': return <MessageSquare size={16} className="text-green-400" />;
      case 'ERROR': return <AlertTriangle size={16} className="text-red-400" />;
      case 'APPROVAL': return <ShieldAlert size={16} className="text-amber-400 animate-pulse" />;
      default: return <Terminal size={16} className="text-gray-400" />;
    }
  };

  const formatContent = (type: string, content: unknown) => {
    if (!content) return "Processing...";
    
    if (type === 'APPROVAL') {
      const approvalData = content as { toolName?: string; args?: unknown };
      return `The agent wants to execute "${approvalData.toolName}".\nArguments:\n${JSON.stringify(approvalData.args, null, 2)}`;
    }
    
    if (type === 'TOOL_CALL') {
      const calls = (content as { tool_calls?: { name: string }[] }).tool_calls || [];
      return calls.map((c: { name: string }) => `Executing ${c.name}...`).join(', ');
    }
    
    if (type === 'TOOL_RESULT') {
      if (!isDeveloperMode) return "Data retrieved successfully.";
      const resultData = content as { content?: string };
      try {
        const parsed = typeof resultData.content === 'string' ? JSON.parse(resultData.content) : resultData.content;
        return JSON.stringify(parsed, null, 2);
      } catch {
        return resultData.content || JSON.stringify(content);
      }
    }

    const result = (content as { content?: string }).content || JSON.stringify(content);
    return typeof result === 'string' ? result.trim() : result;
  };

  const isCompleted = logs.some(l => l.status === 'COMPLETED' || l.status === 'ERROR');

  const containerClasses = isOverlay 
    ? "absolute right-0 top-0 bottom-0 w-96 bg-[#0F172A] text-gray-200 border-l border-white/10 shadow-2xl z-50 flex flex-col font-sans text-sm animate-in slide-in-from-right-8 duration-300"
    : "flex flex-col h-full w-full bg-transparent text-gray-200 font-sans text-sm";

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-2">
          {!isCompleted ? <Loader2 size={16} className="animate-spin text-primary" /> : <Terminal size={16} className="text-primary" />}
          <span className="font-semibold text-white">Execution Trace</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsDeveloperMode(!isDeveloperMode)}
            title="Toggle Developer Mode"
            className={`p-1.5 rounded-md transition-colors ${isDeveloperMode ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-400 hover:text-white'}`}
          >
            <Code2 size={16} />
          </button>
          {isOverlay && (
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-gray-400 hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs - Only show in Developer Mode */}
      {isDeveloperMode && (
        <div className="flex border-b border-white/10 bg-white/5 text-xs">
          <button 
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${activeTab === 'timeline' ? 'border-primary text-white font-medium' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Agent Timeline
          </button>
          <button 
            onClick={() => setActiveTab('raw')}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${activeTab === 'raw' ? 'border-primary text-white font-medium' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Raw System Logs
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {(!isDeveloperMode || activeTab === 'timeline') ? (
          traces.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <BrainCircuit size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Waiting for agent activity...</p>
            </div>
          ) : (
            <div className="relative border-l border-white/10 ml-3 space-y-6">
              {(() => {
                const seenContents = new Set<string>();
                return traces
                  .filter((trace) => {
                    const type = trace.data?.type;
                    const content = trace.data?.content;
                    
                    // Always filter empty thoughts for UI cleanliness
                    if (type === 'THOUGHT') {
                      if (!content) return false;
                      const text = typeof content === 'string' ? content : (content as { content?: string }).content;
                      if (typeof text === 'string' && text.trim() === '') return false;
                    }

                    // In Normal Mode, maybe we don't need to see massive raw DB tool results
                    // but for now we'll just format them cleanly.
                    
                    // Filter exact duplicates
                    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
                    const hash = `${type}:${contentStr}`;
                    if (seenContents.has(hash)) return false;
                    seenContents.add(hash);
                    
                    return true;
                  })
                  .map((trace, i) => (
                    <TraceItem 
                      key={i} 
                      trace={trace} 
                      renderIcon={renderIcon} 
                      formatContent={formatContent}
                      agents={agents}
                      isDeveloperMode={isDeveloperMode}
                      taskId={taskId}
                    />
                  ));
              })()}
            </div>
          )
        ) : (
          <div className="space-y-2 font-mono text-xs">
            {systemLogs.map((log, i) => (
              <div key={i} className={`flex gap-2 p-2 rounded bg-black/20 ${log.status === 'ERROR' ? 'text-red-400 border-l-2 border-red-500' : log.status === 'COMPLETED' ? 'text-green-400' : 'text-gray-400'}`}>
                <span className="opacity-50 shrink-0">[{log.time}]</span> 
                <span className="break-all">[{log.status}] {log.message}</span>
              </div>
            ))}
          </div>
        )}
        
        {!isCompleted && (!isDeveloperMode || activeTab === 'timeline') && traces.length > 0 && (
          <div className="pl-9 flex items-center gap-2 text-gray-500 text-xs animate-pulse mt-6">
            <Loader2 size={12} className="animate-spin" /> Agent is processing...
          </div>
        )}
      </div>
    </div>
  );
}
