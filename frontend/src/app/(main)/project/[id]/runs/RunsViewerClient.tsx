"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Clock, CheckCircle2, XCircle, Loader2, Wrench, MessageSquare, Brain, FileJson, ChevronRight, Activity, Zap } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { TraceContentData, TraceCall } from '@/types';

// Types derived from Prisma
interface TraceStep {
  id: string;
  stepIndex: number;
  agentId: string | null;
  type: string;
  content: TraceContentData;
  createdAt: Date;
}

export interface Run {
  id: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  traces: TraceStep[];
}

export function RunsViewerClient({ runs, projectId, agents = [] }: { runs: Run[], projectId: string, agents?: {id: string, name: string}[] }) {
  const [filterMode, setFilterMode] = useState<"preset" | "hours">("preset");
  const [presetFilter, setPresetFilter] = useState<string>("all");
  const [customHours, setCustomHours] = useState<string>("1");
  const [showRaw, setShowRaw] = useState<boolean>(false);
  
  // Apply date filter
  const filteredRuns = runs.filter(run => {
    const runDate = new Date(run.startedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - runDate.getTime());
    
    if (filterMode === "hours") {
      const diffHours = diffTime / (1000 * 60 * 60);
      const hoursLimit = Number(customHours) || 1;
      return diffHours <= hoursLimit;
    } else {
      if (presetFilter === "all") return true;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      if (presetFilter === "today") return diffDays <= 1;
      if (presetFilter === "7days") return diffDays <= 7;
      if (presetFilter === "30days") return diffDays <= 30;
    }
    return true;
  });

  // Keep selected run consistent, or reset if filtered out
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    filteredRuns.length > 0 ? filteredRuns[0].id : null
  );

  const selectedRun = filteredRuns.find(r => r.id === selectedRunId) || null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "ERROR": return <XCircle className="w-4 h-4 text-destructive" />;
      case "RUNNING": return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTraceIcon = (type: string) => {
    switch (type) {
      case "THOUGHT": return <Brain className="w-4 h-4 text-purple-500" />;
      case "TOOL_CALL": return <Wrench className="w-4 h-4 text-blue-500" />;
      case "TOOL_RESULT": return <FileJson className="w-4 h-4 text-green-600" />;
      case "MESSAGE": return <MessageSquare className="w-4 h-4 text-primary" />;
      case "ERROR": return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDuration = (start: Date, end: Date | null) => {
    if (!end) return "Running...";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Left Sidebar: Runs List */}
      <div className="w-80 border-r flex flex-col bg-card shrink-0 h-full">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Audit Logs
            </h2>
          </div>
          <div className="mt-4 flex flex-col gap-2 bg-muted/20 p-2 rounded-lg border">
            {/* Preset Range Option */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                checked={filterMode === "preset"} 
                onChange={() => {
                  setFilterMode("preset");
                  setSelectedRunId(null);
                }}
                className="text-primary focus:ring-primary w-3.5 h-3.5"
              />
              <span className="text-xs font-medium text-foreground">Date Range</span>
            </label>
            <div className="pl-5" onClick={() => {
                  if (filterMode !== "preset") {
                    setFilterMode("preset");
                    setSelectedRunId(null);
                  }
                }}>
              <Select 
                value={presetFilter}
                onChange={(val) => {
                  setPresetFilter(val);
                  setSelectedRunId(null);
                }}
                className={filterMode !== "preset" ? "opacity-50" : ""}
                options={[
                  { value: "all", label: "All Time" },
                  { value: "today", label: "Today" },
                  { value: "7days", label: "Last 7 Days" },
                  { value: "30days", label: "Last 30 Days" }
                ]}
              />
            </div>

            <div className="h-px bg-border/50 my-1"></div>

            {/* Custom Hours Option */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="radio" 
                checked={filterMode === "hours"} 
                onChange={() => {
                  setFilterMode("hours");
                  setSelectedRunId(null);
                }}
                className="text-primary focus:ring-primary w-3.5 h-3.5"
              />
              <span className="text-xs font-medium text-foreground">Recent Hours</span>
            </label>
            <div className="pl-5 flex items-center gap-2">
              <span className={`text-xs whitespace-nowrap transition-opacity ${filterMode !== "hours" ? "text-muted-foreground/50" : "text-muted-foreground"}`}>Last</span>
              <input 
                type="number" 
                min="1"
                value={customHours}
                onFocus={() => {
                  if (filterMode !== "hours") {
                    setFilterMode("hours");
                    setSelectedRunId(null);
                  }
                }}
                onChange={(e) => {
                  // Validate: Only allow positive digits (remove '-', 'e', '.', and letters)
                  const sanitizedValue = e.target.value.replace(/[^0-9]/g, '');
                  setCustomHours(sanitizedValue);
                }}
                className={`flex-1 w-full bg-background border text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground transition-opacity ${filterMode !== "hours" ? "opacity-50 border-transparent" : "border-border"}`}
              />
              <span className={`text-xs whitespace-nowrap transition-opacity ${filterMode !== "hours" ? "text-muted-foreground/50" : "text-muted-foreground"}`}>hours</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredRuns.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground mt-10">
              <Zap className="w-8 h-8 opacity-20 mx-auto mb-2" />
              No runs found.<br/>Deploy from Canvas or Playground to see traces.
            </div>
          ) : (
            filteredRuns.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                className={`w-full text-left p-3 rounded-lg flex items-start justify-between border transition-all ${
                  selectedRunId === run.id 
                    ? "bg-primary/5 border-primary/30 shadow-sm" 
                    : "bg-background border-transparent hover:border-border hover:bg-muted/50"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    {getStatusIcon(run.status)}
                    <span>{run.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span title={new Date(run.startedAt).toLocaleString()}>
                      {format(new Date(run.startedAt), "MMM d, HH:mm:ss")}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                  {formatDuration(run.startedAt, run.completedAt)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Run Details & Timeline */}
      <div className="flex-1 flex flex-col h-full bg-muted/10 overflow-hidden">
        {selectedRun ? (
          <>
            <div className="bg-card border-b p-5 shrink-0 shadow-sm z-10">
              <h1 className="text-xl font-bold flex items-center gap-2">
                Trace Details
                <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded-md font-normal border">
                  {selectedRun.id}
                </span>
              </h1>
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  {getStatusIcon(selectedRun.status)}
                  <span className="font-medium text-foreground">{selectedRun.status}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {format(new Date(selectedRun.startedAt), "PP pp")}
                </div>
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  {selectedRun.traces.length} Steps
                </div>
                
                <div className="ml-auto">
                  <button 
                    onClick={() => setShowRaw(!showRaw)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors border ${
                      showRaw 
                        ? "bg-primary/10 text-primary border-primary/20" 
                        : "bg-muted text-muted-foreground border-transparent hover:text-foreground"
                    }`}
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    {showRaw ? "Raw View" : "Pretty View"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6 pb-20">
                {selectedRun.traces.length === 0 ? (
                  <div className="text-center text-muted-foreground mt-20 border border-dashed rounded-lg p-10 bg-card">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/30 mx-auto mb-4" />
                    <p>No trace steps recorded yet.</p>
                  </div>
                ) : (
                  <div className="relative border-l border-muted-foreground/20 ml-4 space-y-8 pb-4">
                    {selectedRun.traces.map((trace, idx) => (
                      <div key={trace.id} className="relative pl-6">
                        {/* Timeline node */}
                        <div className="absolute -left-3 top-0 bg-card p-1 rounded-full border shadow-sm">
                          {getTraceIcon(trace.type)}
                        </div>
                        
                        <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                          <div className="bg-muted/30 p-3 border-b flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-foreground/10 uppercase tracking-wider">
                                {trace.type}
                              </span>
                              {trace.agentId && (
                                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Bot className="w-3 h-3" />
                                  {(() => {
                                    const agentObj = agents.find(a => a.id === trace.agentId);
                                    return agentObj ? `${trace.agentId} ${agentObj.name}` : trace.agentId;
                                  })()}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Step {trace.stepIndex + 1} • {format(new Date(trace.createdAt), "HH:mm:ss.SSS")}
                            </span>
                          </div>
                          
                          <div className="p-4 text-sm relative">
                            <TraceContent type={trace.type} content={trace.content} showRaw={showRaw} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Activity className="w-12 h-12 opacity-20 mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">Audit Logging Dashboard</p>
              <p className="text-sm mt-1">Select a run from the sidebar to view its detailed execution trace.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component to render beautiful trace payloads with a raw toggle
function TraceContent({ type, content, showRaw }: { type: string, content: TraceContentData, showRaw: boolean }) {
  const renderBeautiful = () => {
    try {
      if (type === 'MESSAGE') {
        const text = (content as { text?: string, content?: string }).text || (content as { text?: string, content?: string }).content || JSON.stringify(content);
        return <div className="whitespace-pre-wrap text-foreground leading-relaxed">{text}</div>;
      }
      
      if (type === 'THOUGHT') {
        const text = (content as { text?: string, content?: string }).text || (content as { text?: string, content?: string }).content || JSON.stringify(content);
        return <div className="text-muted-foreground italic border-l-2 border-primary/30 pl-4 py-1.5">{text}</div>;
      }

      if (type === 'TOOL_CALL') {
        const calls = (content as { tool_calls?: TraceCall[] }).tool_calls || [];
        if (calls.length === 0) return <div className="text-muted-foreground">Calling tool...</div>;
        return (
          <div className="space-y-3">
            {calls.map((call: TraceCall, idx: number) => (
              <div key={idx} className="border border-border/50 rounded p-2 mb-2 bg-muted/20">
                <div className="font-semibold text-lg text-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-500" />
                Executing Tool: <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">{(content as { name?: string }).name || 'Unknown Tool'}</span>
              </div>
                {call.inputs && Object.keys(call.inputs).length > 0 && (
                  <div className="bg-background rounded-md border p-2 text-xs overflow-x-auto shadow-sm">
                    <table className="min-w-full text-left">
                      <tbody>
                        {Object.entries(call.inputs).map(([key, val]) => (
                          <tr key={key} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                            <td className="py-1.5 pl-2 pr-4 font-semibold text-muted-foreground w-1/4 align-top">{key}</td>
                            <td className="py-1.5 pr-2 font-mono text-foreground break-all">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      }

      if (type === 'TOOL_RESULT') {
        const resultName = (content as { name?: string }).name || "Tool";
        const resultContent = (content as { content?: string }).content || content;
        let displayStr = typeof resultContent === 'string' ? resultContent : JSON.stringify(resultContent, null, 2);
        
        return (
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
            <div className="text-xs font-bold text-green-600 mb-2 uppercase tracking-widest flex items-center gap-2">
              <FileJson className="w-4 h-4" /> Result from {resultName}
            </div>
            <div className="text-[11px] bg-background p-3 rounded border max-h-48 overflow-y-auto font-mono text-foreground whitespace-pre-wrap shadow-inner custom-scrollbar">
              {displayStr}
            </div>
          </div>
        );
      }

      if (type === 'ERROR') {
        const errorMsg = (content as { error?: string }).error || (content as { message?: string }).message || JSON.stringify(content);
        return <div className="text-destructive font-mono bg-destructive/10 p-2 rounded border border-destructive/20">{errorMsg}</div>;
      }
      
    } catch (e) {
      // Fallback handled below
    }

    // Default Fallback
    return (
      <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed shadow-inner custom-scrollbar">
        <code>{JSON.stringify(content, null, 2)}</code>
      </pre>
    );
  };

  if (showRaw) {
    return (
      <pre className="bg-zinc-950 text-zinc-50 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed shadow-inner custom-scrollbar">
        <code>{JSON.stringify(content, null, 2)}</code>
      </pre>
    );
  }

  return <>{renderBeautiful()}</>;
}

function Bot(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}
