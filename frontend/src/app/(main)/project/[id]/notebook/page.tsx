"use client";

import { NotebookEditor } from "@/components/notebook/Editor";

export default function NotebookPage() {
  return (
    <div className="flex h-full w-full">
      {/* Main Editor Area */}
      <div className="flex-1 p-6 flex flex-col h-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Agent Note</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Press &apos;/&apos; for commands or type &apos;@&apos; to mention and interact with your AI Agents.
          </p>
        </div>
        
        <div className="flex-1 min-h-0">
          <NotebookEditor onChange={() => {}} />
        </div>
      </div>

      {/* Right Sidebar for Configuration */}
      <div className="w-80 border-l bg-card p-6 flex flex-col gap-6 overflow-auto">
        <div>
          <h3 className="font-semibold mb-2">Agent Configuration</h3>
          <p className="text-sm text-muted-foreground mb-4">Set the core parameters for this agent.</p>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Agent Name</label>
              <input type="text" className="w-full p-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="e.g. Code Reviewer" />
            </div>
            
            <div>
              <label className="text-sm font-medium block mb-1.5">LLM Provider</label>
              <select className="w-full p-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="openai">OpenAI (gpt-4o)</option>
                <option value="anthropic">Anthropic (claude-3.5-sonnet)</option>
                <option value="local">Local (Ollama / Llama3)</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="pt-6 border-t">
          <h3 className="font-semibold mb-3">Attached Tools</h3>
          <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg border border-dashed">
            Type <kbd className="bg-background px-1.5 py-0.5 rounded border font-mono text-xs shadow-sm">@</kbd> in the editor to discover and attach MCP tools automatically.
          </div>
        </div>

        <div className="mt-auto pt-6">
          <button className="w-full bg-primary text-primary-foreground py-2.5 rounded-md font-medium shadow hover:bg-primary/90 transition-colors">
            Save Blueprint
          </button>
        </div>
      </div>
    </div>
  );
}
