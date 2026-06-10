import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { AgentDelegateComponent } from './AgentDelegateComponent';

export const AgentDelegateExtension = Node.create({
  name: 'agentDelegate',

  group: 'inline',

  inline: true,

  selectable: true,

  atom: true,

  addAttributes() {
    return {
      agentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-agent-id'),
        renderHTML: attributes => {
          if (!attributes.agentId) return {};
          return { 'data-agent-id': attributes.agentId };
        },
      },
      agentName: {
        default: null,
        parseHTML: element => element.getAttribute('data-agent-name'),
        renderHTML: attributes => {
          if (!attributes.agentName) return {};
          return { 'data-agent-name': attributes.agentName };
        },
      },
      agentDesc: {
        default: null,
        parseHTML: element => element.getAttribute('data-agent-desc'),
        renderHTML: attributes => {
          if (!attributes.agentDesc) return {};
          return { 'data-agent-desc': attributes.agentDesc };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="agent-delegate"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'agent-delegate' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AgentDelegateComponent);
  },
});
