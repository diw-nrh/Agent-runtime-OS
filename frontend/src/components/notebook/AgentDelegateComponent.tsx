import React from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Bot, MessageSquare } from 'lucide-react';

export function AgentDelegateComponent({ node }: NodeViewProps) {
  const { agentId, agentName, agentDesc } = node.attrs;

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const event = new CustomEvent('openAgentDescription', {
      detail: { agentName, agentDesc }
    });
    window.dispatchEvent(event);
  };

  return (
    <NodeViewWrapper className="inline-block align-middle mx-1 group/delegate" as="span" contentEditable={false}>
      <span 
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium text-sm transition-colors select-none hover:bg-blue-500/20 cursor-pointer shadow-sm"
        onDoubleClick={handleDoubleClick}
        title="Double click to view details"
      >
        {agentId?.startsWith('io_node') ? (
          <MessageSquare className="w-3.5 h-3.5" />
        ) : (
          <Bot className="w-3.5 h-3.5" />
        )}
        {agentName || 'Unknown Agent'}
      </span>
    </NodeViewWrapper>
  );
}
