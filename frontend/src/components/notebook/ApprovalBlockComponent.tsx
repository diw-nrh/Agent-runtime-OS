import React, { useState } from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { getBackendUrl } from '@/lib/utils';
import { Check, X, ShieldAlert, Loader2 } from 'lucide-react';

export const ApprovalPanelUI: React.FC<{
  taskId: string;
  toolName: string;
  status: string;
  timestamp?: Date;
  args: Record<string, unknown>;
  onUpdate: (attrs: Record<string, unknown>) => void;
}> = ({ taskId, toolName, status, timestamp, args, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      // The Next.js API endpoint for approving/rejecting tools
      // This will call the FastAPI backend to send the signal to Celery
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/agent/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task_id: taskId,
          tool_name: toolName,
          action: action
        })
      });

      if (res.ok) {
        onUpdate({
          status: action === 'approve' ? 'approved' : 'rejected',
          timestamp: new Date().toLocaleTimeString()
        });
      } else {
        console.error("Failed to approve/reject");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-4 rounded-lg border transition-all duration-300 ${
      status === 'approved' ? 'bg-green-500/10 border-green-500/30' :
      status === 'rejected' ? 'bg-destructive/10 border-destructive/30' :
      'bg-amber-500/10 border-amber-500/30 shadow-sm'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 p-1.5 rounded-full ${
            status === 'approved' ? 'bg-green-500/20 text-green-500' :
            status === 'rejected' ? 'bg-destructive/20 text-destructive' :
            'bg-amber-500/20 text-amber-500 animate-pulse'
          }`}>
            {status === 'approved' ? <Check size={18} /> : 
             status === 'rejected' ? <X size={18} /> : 
             <ShieldAlert size={18} />}
          </div>
          
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2">
              {status === 'pending' && "Agent Paused: Human Approval Required"}
              {status === 'approved' && "Approved"}
              {status === 'rejected' && "Rejected"}
              
              {timestamp && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {typeof timestamp === 'object' && timestamp instanceof Date ? timestamp.toLocaleString() : String(timestamp)}
                </span>
              )}
            </h4>
            
            <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
              The agent requested to execute <strong className="text-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">{toolName}</strong>
              {status === 'pending' && " which requires explicit permission."}
            </div>
            
            {args && (
              <div className="mt-3 bg-background/50 border rounded p-2 overflow-x-auto">
                <pre className="text-xs font-mono text-muted-foreground m-0 whitespace-pre-wrap">
                  {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
        
        {status === 'pending' && (
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => handleAction('reject')}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <X size={14} />
              Reject
            </button>
            <button 
              onClick={() => handleAction('approve')}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const ApprovalBlockComponent: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const { taskId, toolName, status, timestamp, args } = node.attrs;

  return (
    <NodeViewWrapper className="my-4">
      <ApprovalPanelUI 
        taskId={taskId} 
        toolName={toolName} 
        status={status} 
        timestamp={timestamp} 
        args={args} 
        onUpdate={updateAttributes} 
      />
    </NodeViewWrapper>
  );
};
