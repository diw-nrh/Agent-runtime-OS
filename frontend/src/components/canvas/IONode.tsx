import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { MessageSquare, ArrowRightToLine, PlayCircle } from 'lucide-react';
import { AgentNodeProps } from '@/types/canvas';

export function IONode({ id, data, selected }: AgentNodeProps & { selected?: boolean }) {
  const { updateNodeData } = useReactFlow();
  const [localLabel, setLocalLabel] = useState(data.label || 'System IO');

  useEffect(() => { setLocalLabel(data.label || 'System IO'); }, [data.label]);

  const handleLabelBlur = () => {
    const finalLabel = localLabel.trim() || 'System IO';
    setLocalLabel(finalLabel);
    updateNodeData(id, { ...data, label: finalLabel });
  };

  return (
    <div className={`w-[260px] glass-card rounded-xl border shadow-lg transition-all duration-200 ${selected ? 'border-primary shadow-primary/20 ring-1 ring-primary/50' : 'border-border/60 hover:border-border/80'} group bg-background/80 backdrop-blur-xl`}>

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <MessageSquare size={14} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onBlur={handleLabelBlur}
              className="w-full bg-transparent border-none text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-1 truncate placeholder:text-muted-foreground/50"
              placeholder="IO Node Name"
            />
          </div>
        </div>

        {/* Ports Visualization */}
        <div className="flex flex-col gap-2 mt-4 text-xs font-medium">
          {/* Output Port */}
          <div className="relative flex items-center justify-between bg-blue-500/10 border border-blue-500/20 rounded-md p-2">
            <Handle
              type="target"
              position={Position.Left}
              id="output"
              className="w-3 h-3 border-2 border-background !bg-blue-500 rounded-full hover:scale-125 transition-transform cursor-crosshair z-10"
              style={{ left: '-18px' }}
            />
            <div className="flex items-center gap-1.5 text-blue-500">
              <ArrowRightToLine size={12} />
              <span>Output (Display)</span>
            </div>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">In</span>
          </div>

          {/* End Port */}
          <div className="relative flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-md p-2">
            <Handle
              type="target"
              position={Position.Left}
              id="end"
              className="w-3 h-3 border-2 border-background !bg-red-500 rounded-full hover:scale-125 transition-transform cursor-crosshair z-10"
              style={{ left: '-18px' }}
            />
            <div className="flex items-center gap-1.5 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 9h6v6H9z"/></svg>
              <span>End Program</span>
            </div>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">In</span>
          </div>

          {/* Input Port */}
          <div className="relative flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-md p-2 mt-2">
            <Handle
              type="source"
              position={Position.Right}
              id="input"
              className="w-3 h-3 border-2 border-background !bg-green-500 rounded-full hover:scale-125 transition-transform cursor-crosshair z-10"
              style={{ right: '-18px' }}
            />
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Out</span>
            <div className="flex items-center gap-1.5 text-green-500">
              <span>Input (Start)</span>
              <PlayCircle size={12} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
