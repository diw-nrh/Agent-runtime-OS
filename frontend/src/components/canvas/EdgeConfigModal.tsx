import React, { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { X, Network, Trash2 } from 'lucide-react';
import { Select } from '@/components/ui/Select';

interface EdgeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  edgeId?: string;
  sourceNodeId?: string;
  initialTargetId?: string;
  initialMode?: 'delegate' | 'sequential';
  nodes: Node[];
  onSave: (targetId: string, mode: 'delegate' | 'sequential', edgeId?: string) => void;
  onDelete?: (edgeId: string) => void;
}

export default function EdgeConfigModal({
  isOpen,
  onClose,
  edgeId,
  sourceNodeId,
  initialTargetId,
  initialMode = 'delegate',
  nodes,
  onSave,
  onDelete
}: EdgeConfigModalProps) {
  const [mode, setMode] = useState<'delegate' | 'sequential'>(initialMode);
  const [targetId, setTargetId] = useState<string>(initialTargetId || '');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setTargetId(initialTargetId || '');
    }
  }, [isOpen, initialMode, initialTargetId]);

  if (!isOpen) return null;

  const isEditing = !!edgeId;
  const sourceNode = sourceNodeId ? nodes.find(n => n.id === sourceNodeId) : null;
  const availableTargets = nodes.filter(n => n.type === 'agent' && n.id !== sourceNodeId);

  const handleSave = () => {
    if (!targetId && !isEditing) return; // Prevent save if no target when creating
    // If editing, we might not change the target (or we don't even allow changing target)
    onSave(targetId || initialTargetId || '', mode, edgeId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card w-[450px] border shadow-2xl rounded-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{isEditing ? 'Edit Connection' : 'Create Connection'}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!isEditing && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                From: {String(sourceNode?.data?.label || 'Unknown Agent')}
              </label>
              <label className="text-sm font-medium block mb-1.5">Connect to Agent</label>
              <Select
                value={targetId}
                onChange={(val) => setTargetId(val)}
                placeholder="Select Target Agent..."
                options={availableTargets.map(n => ({
                  value: n.id,
                  label: n.data.label as string || 'Unnamed Agent'
                }))}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-3">Connection Type</label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input 
                  type="radio" 
                  name="modalEdgeMode" 
                  checked={mode === 'delegate'} 
                  onChange={() => setMode('delegate')}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-semibold text-sm">Swarm Delegate (Tool)</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    The source agent can decide dynamically when to call the target agent. (Dashed Line)
                  </p>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input 
                  type="radio" 
                  name="modalEdgeMode" 
                  checked={mode === 'sequential'} 
                  onChange={() => setMode('sequential')}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-semibold text-sm">Sequential Pipeline</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Strict execution. Source agent must finish entirely before Target agent begins. (Solid Line)
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-muted/10 flex justify-between items-center">
          {isEditing && onDelete ? (
            <button 
              onClick={() => { onDelete(edgeId); onClose(); }}
              className="text-destructive hover:bg-destructive/10 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-md transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={!isEditing && !targetId}
              className="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium rounded-md shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Save Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
