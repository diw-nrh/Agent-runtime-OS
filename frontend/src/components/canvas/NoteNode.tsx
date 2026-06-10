import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { StickyNote } from 'lucide-react';

interface NoteNodeProps {
  id: string;
  data: {
    content?: string;
  };
}

export function NoteNode({ id, data }: NoteNodeProps) {
  const { updateNodeData } = useReactFlow();
  const [localContent, setLocalContent] = useState(data.content || '');

  useEffect(() => {
    setLocalContent(data.content || '');
  }, [data.content]);

  const handleBlur = () => {
    updateNodeData(id, { ...data, content: localContent });
  };

  return (
    <div className="bg-[#fef3c7] text-amber-900 border border-amber-200 rounded-sm w-64 overflow-hidden relative group" style={{ boxShadow: '2px 4px 12px rgba(0,0,0,0.08)' }}>
      {/* Optional Handle for connecting notes - hidden until hover */}
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-amber-500 border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Note Header / Drag handle area */}
      <div className="bg-[#fde68a] p-2 flex items-center justify-between border-b border-amber-200/50">
        <div className="flex items-center gap-1.5 w-full">
          <StickyNote size={14} className="text-amber-700" />
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Note</span>
        </div>
      </div>
      
      {/* Note Body */}
      <div className="p-3 nodrag cursor-text">
        <textarea
          className="w-full text-sm bg-transparent border-none resize-none outline-none focus:ring-0 placeholder:text-amber-900/40 min-h-[120px]"
          placeholder="Write your thoughts, explain logic, or leave a message for the team..."
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleBlur}
        />
      </div>
      
      {/* Note fold effect in corner */}
      <div className="absolute bottom-0 right-0 w-4 h-4 bg-gradient-to-tl from-amber-200 to-transparent border-t border-l border-amber-200/50 rounded-tl-sm pointer-events-none"></div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-amber-500 border-none opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
