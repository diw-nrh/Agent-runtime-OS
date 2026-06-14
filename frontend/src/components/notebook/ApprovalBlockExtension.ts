import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ApprovalBlockComponent } from './ApprovalBlockComponent';

export const ApprovalBlockExtension = Node.create({
  name: 'approvalBlock',

  group: 'block',

  content: 'inline*',

  selectable: true,

  atom: true,

  addAttributes() {
    return {
      taskId: {
        default: null,
      },
      toolName: {
        default: null,
      },
      status: {
        default: 'pending', // pending, approved, rejected
      },
      timestamp: {
        default: null,
      },
      args: {
        default: null,
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="approval-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'approval-block' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ApprovalBlockComponent);
  },
});
