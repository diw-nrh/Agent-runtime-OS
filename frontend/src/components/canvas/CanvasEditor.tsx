"use client";

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode } from './AgentNode';
import { Play, Loader2, X } from 'lucide-react';

const nodeTypes = {
  agent: AgentNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

import { useDeployBlueprint } from '../../hooks/useDeployBlueprint';

export interface CanvasEditorProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  blueprintId?: string;
  projectName?: string;
  projectDescription?: string;
}

export function CanvasEditor({ 
  initialNodes: propNodes, 
  initialEdges: propEdges, 
  blueprintId,
  projectName,
  projectDescription
}: CanvasEditorProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(propNodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(propEdges || initialEdges);
  
  const { deploy, saveBlueprint, isDeploying, taskId, logs, closeConsole } = useDeployBlueprint();

  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `agent-${Date.now()}`,
        type,
        position,
        data: { label: `New Agent`, model: 'openai/gpt-4o-mini', system_prompt: 'You are a helpful assistant.' },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  const handleDeploy = () => {
    deploy(nodes, edges, blueprintId, projectName, projectDescription);
  };

  return (
    <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper} className="relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        className="bg-muted/10"
      >
        <Controls className="bg-card border rounded-md shadow-sm" />
        <MiniMap zoomable pannable className="bg-card border rounded-lg shadow-md" maskColor="rgba(0,0,0,0.1)" />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} color="currentColor" className="opacity-10 text-muted-foreground" />
        
        <Panel position="top-right" className="m-4 flex gap-2">
          <button 
            onClick={() => saveBlueprint(nodes, edges, blueprintId, projectName, projectDescription)}
            disabled={isDeploying}
            className="bg-secondary text-secondary-foreground flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium shadow-md hover:bg-secondary/80 transition-all active:scale-95 border disabled:opacity-70 disabled:pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
            Save
          </button>
          <button 
            onClick={handleDeploy}
            disabled={isDeploying}
            className="bg-primary text-primary-foreground flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:pointer-events-none"
          >
            {isDeploying ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Play size={16} className="fill-current" />
            )}
            {isDeploying ? 'Working...' : 'Deploy to Engine'}
          </button>
        </Panel>
      </ReactFlow>

      {/* Streaming Console UI */}
      {taskId && (
        <div className="absolute bottom-4 left-4 right-4 bg-black/90 text-green-400 p-4 rounded-lg shadow-2xl font-mono text-sm max-h-64 overflow-y-auto border border-white/20 z-50">
          <div className="flex justify-between items-center mb-3 border-b border-white/20 pb-2">
            <span className="font-bold text-white flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Agent Execution Console (Task: {taskId.substring(0,8)}...)
            </span>
            <button onClick={closeConsole} className="text-gray-400 hover:text-white bg-white/10 p-1 rounded-md">
              <X size={16} />
            </button>
          </div>
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${log.status === 'ERROR' ? 'text-red-400' : 'text-green-400'}`}>
              <span className="text-gray-500">[{log.time}]</span> [{log.status}] {log.message}
            </div>
          ))}
          {logs.length > 0 && logs[logs.length-1].status !== 'COMPLETED' && logs[logs.length-1].status !== 'ERROR' && (
            <div className="animate-pulse text-gray-500 mt-2">Waiting for agent response...</div>
          )}
        </div>
      )}
    </div>
  );
}
