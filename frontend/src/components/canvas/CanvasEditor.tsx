"use client";

import React, { useCallback, useRef, useState, useEffect } from 'react';
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
import { useDeployBlueprint } from '../../hooks/useDeployBlueprint';
import DebuggerPanel from './DebuggerPanel';
import { useRouter, usePathname } from 'next/navigation';
import ConfigurableEdge from './ConfigurableEdge';
import EdgeConfigModal from './EdgeConfigModal';

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  configurable: ConfigurableEdge,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

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
  
  // Edge Modal State
  const [edgeModalOpen, setEdgeModalOpen] = useState(false);
  const [editEdgeId, setEditEdgeId] = useState<string | undefined>();
  const [createSourceId, setCreateSourceId] = useState<string | undefined>();

  // Global event listener for custom edge clicks and handle clicks
  React.useEffect(() => {
    const handleOpenModal = (e: any) => {
      const { edgeId, sourceId } = e.detail;
      setEditEdgeId(edgeId);
      setCreateSourceId(sourceId);
      setEdgeModalOpen(true);
    };

    window.addEventListener('openEdgeModal', handleOpenModal);
    return () => window.removeEventListener('openEdgeModal', handleOpenModal);
  }, []);

  const handleSaveEdge = (targetId: string, mode: 'delegate' | 'sequential', edgeId?: string) => {
    if (edgeId) {
      // Edit existing edge
      setEdges((eds) => eds.map(e => 
        e.id === edgeId ? { 
          ...e, 
          data: { ...e.data, mode }, 
          type: 'configurable', 
          animated: mode === 'delegate',
          style: mode === 'delegate' ? { strokeDasharray: '5,5' } : undefined
        } : e
      ));
    } else if (createSourceId) {
      // Create new edge
      const newEdgeId = `edge-${Date.now()}`;
      const newEdge: Edge = {
        id: newEdgeId,
        source: createSourceId,
        target: targetId,
        type: 'configurable',
        animated: mode === 'delegate',
        style: mode === 'delegate' ? { strokeDasharray: '5,5' } : undefined,
        data: { mode, instruction: '' }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    }
  };

  const handleDeleteEdge = (edgeId: string) => {
    setEdges((eds) => eds.filter(e => e.id !== edgeId));
  };
  
  const router = useRouter();
  const pathname = usePathname();

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      const newEdgeId = 'id' in params ? params.id : `edge-${Date.now()}`;
      setEdges((eds) => addEdge({ 
        ...params, 
        id: newEdgeId,
        type: 'configurable',
        data: { mode: 'delegate', instruction: '' },
        animated: true,
        style: { strokeDasharray: '5,5' }
      }, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const getUniqueAgentName = (currentNodes: Node[]) => {
    let i = 1;
    let newLabel = `New Agent`;
    while (currentNodes.some(n => n.type === 'agent' && n.data.label === newLabel)) {
      i++;
      newLabel = `New Agent ${i}`;
    }
    return newLabel;
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setNodes((nds) => {
        const newNode = {
          id: `${type}-${Date.now()}`,
          type,
          position,
          data: type === 'agent' 
            ? { label: getUniqueAgentName(nds), model: 'openai/gpt-4o-mini', system_prompt: 'You are a helpful assistant.' }
            : { content: '' },
        };
        return nds.concat(newNode);
      });
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
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ 
          type: 'configurable',
          animated: true,
        }}
        fitView
        className="bg-muted/10"
      >
        <Controls className="bg-card border rounded-md shadow-sm" />
        <MiniMap zoomable pannable className="bg-card border rounded-lg shadow-md" maskColor="rgba(0,0,0,0.1)" />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} color="currentColor" className="opacity-10 text-muted-foreground" />
        
        <Panel position="top-right" className="m-4 flex gap-2">
          <button 
            onClick={() => {
              setNodes((nds) => {
                const newNode = {
                  id: `agent-${Date.now()}`,
                  type: 'agent',
                  position: { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 },
                  data: { label: getUniqueAgentName(nds), model: '', system_prompt: 'You are a helpful assistant.' },
                };
                return nds.concat(newNode);
              });
            }}
            className="bg-background text-foreground flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium shadow-md hover:bg-muted transition-all active:scale-95 border"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Add Agent
          </button>
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

      {/* Streaming Console UI / Debugger Panel */}
      {taskId && (
        <DebuggerPanel 
          taskId={taskId} 
          logs={logs} 
          onClose={closeConsole}
          agents={nodes.filter(n => n.type === 'agent').map(n => ({ id: n.id, name: n.data.name }))}
        />
      )}

      {/* Edge Configuration Modal */}
      <EdgeConfigModal
        isOpen={edgeModalOpen}
        onClose={() => setEdgeModalOpen(false)}
        edgeId={editEdgeId}
        sourceNodeId={createSourceId}
        nodes={nodes}
        onSave={handleSaveEdge}
        onDelete={handleDeleteEdge}
        initialMode={editEdgeId ? (edges.find(e => e.id === editEdgeId)?.data?.mode as 'delegate'|'sequential') : 'delegate'}
        initialTargetId={editEdgeId ? edges.find(e => e.id === editEdgeId)?.target : ''}
      />
    </div>
  );
}
