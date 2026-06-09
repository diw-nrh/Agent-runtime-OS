"use client";

import { CanvasEditor } from "@/components/canvas/CanvasEditor";
import { Bot, Plus } from "lucide-react";
import { ReactFlowProvider } from "@xyflow/react";
import type { Node, Edge } from '@xyflow/react';

export interface CanvasLayoutClientProps {
  blueprintId?: string;
  projectName?: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

import { useState } from "react";
import { Edit2 } from "lucide-react";

// ... Inside the component

export function CanvasLayoutClient({ blueprintId, projectName = "Untitled Project", initialNodes, initialEdges }: CanvasLayoutClientProps) {
  // Try to find description from initial canvas payload if available, else use default
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState("A custom AI agent workflow blueprint.");
  const [isEditing, setIsEditing] = useState(false);

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex h-full w-full">
      {/* Left Sidebar for Dragging Nodes */}
      <div className="w-72 border-r bg-card p-5 flex flex-col gap-4 z-10 shadow-sm relative">
        
        {/* Editable Project Header */}
        <div 
          className="group relative -mx-2 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <input 
                autoFocus
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background border px-2 py-1 text-lg font-semibold rounded focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Project Name"
              />
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-background border px-2 py-1 text-xs text-muted-foreground rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary h-16"
                placeholder="Project description..."
              />
              <div className="flex justify-end">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg tracking-tight line-clamp-1">{name}</h2>
                <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-4">
          {/* Draggable Agent Item */}
          <div 
            className="border rounded-lg p-3 bg-background flex items-center gap-3 cursor-grab hover:border-primary hover:shadow-sm transition-all active:cursor-grabbing"
            onDragStart={(event) => onDragStart(event, 'agent')}
            draggable
          >
            <div className="bg-primary/10 text-primary p-2 rounded-md">
              <Bot size={20} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Agent Node</div>
              <div className="text-xs text-muted-foreground">Core reasoning engine</div>
            </div>
          </div>
          
          {/* Condition Node (Placeholder) */}
          <div className="border border-dashed rounded-lg p-3 bg-muted/30 flex items-center gap-3 cursor-not-allowed opacity-50">
            <div className="bg-muted text-muted-foreground p-2 rounded-md">
              <Plus size={20} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Condition</div>
              <div className="text-xs text-muted-foreground">Coming soon</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative bg-background">
        <ReactFlowProvider>
          <CanvasEditor 
            blueprintId={blueprintId} 
            projectName={name}
            projectDescription={description}
            initialNodes={initialNodes} 
            initialEdges={initialEdges} 
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
