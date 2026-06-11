"use client";

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import { createMentionSuggestion } from './mentionSuggestion';
import { createAgentSuggestion } from './agentSuggestion';
import { AgentDelegateExtension } from './AgentDelegateExtension';
import { createSkillSuggestion } from './skillSuggestion';

const AgentMention = Mention.extend({ name: 'agentMention' });
const SkillMention = Mention.extend({ name: 'skillMention' });

import { mergeAttributes } from '@tiptap/core';
import { createForceToolSuggestion } from './forceToolSuggestion';

const ForceToolMention = Mention.extend({ 
  name: 'forceToolMention',
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        'data-id': node.attrs.id,
      }),
      `[${node.attrs.label ?? node.attrs.id}]`,
    ]
  },
});

interface NotebookEditorProps {
  projectId: string;
  initialContent?: string;
  onChange?: (content: string) => void;
  onAddTool?: (toolId: string) => void;
  editorRef?: React.MutableRefObject<any>;
  availableAgents?: any[];
  onAddAgentConnection?: (targetId: string) => void;
  minimal?: boolean;
  onBlur?: () => void;
}

export function NotebookEditor({ projectId, initialContent, onChange, onAddTool, editorRef, availableAgents = [], onAddAgentConnection, minimal, onBlur }: NotebookEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      AgentDelegateExtension,
      Mention.configure({
        HTMLAttributes: {
          class: 'bg-primary/20 text-primary px-1 rounded-md font-medium cursor-pointer',
        },
        suggestion: createMentionSuggestion(projectId, onAddTool),
      }),
      AgentMention.configure({
        suggestion: createAgentSuggestion(availableAgents, onAddAgentConnection),
      }),
      ForceToolMention.configure({
        suggestion: createForceToolSuggestion(projectId, onAddTool),
        HTMLAttributes: {
          class: 'bg-red-500/20 text-red-600 px-1 rounded-md font-bold cursor-pointer border border-red-500/30',
        },
      }),
      SkillMention.configure({
        suggestion: createSkillSuggestion(projectId),
        HTMLAttributes: {
          class: 'bg-amber-500/20 text-amber-600 px-1 rounded-md font-medium cursor-pointer',
        },
      }),
    ],
    immediatelyRender: false,
    content: initialContent || (minimal ? '' : '<p> <strong>Welcome to your Agent Setup!</strong> Start writing your System Prompt here...</p><p>This is where you define your Agent\'s role and logic. To empower your Agent with OS capabilities, simply type these <strong>Default Symbols</strong> anywhere in the prompt:</p><ul><li><code>@</code> <strong>(Attach Tool):</strong> Connect MCP Tools to give this agent real-world abilities.</li><li><code>#</code> <strong>(Swarm Handoff):</strong> Link to another Agent to delegate tasks to them.</li><li><code>~</code> <strong>(Add Skill):</strong> Inject reusable prompt templates or knowledge bases.</li><li><code>[</code> <strong>(Force Tool):</strong> Strictly force the Agent to execute a specific tool immediately.</li><li><code>/</code> <strong>(Quick Menu):</strong> Open the formatting command palette.</li></ul><p><em>💡 <strong>Pro Tip:</strong> Using these symbols is the standard way to wire up your Swarm architecture. The system will parse them automatically!</em></p>'),
    editorProps: {
      attributes: {
        class: `outline-none ${minimal ? 'min-h-[80px] text-xs leading-normal [&>p]:mb-2' : 'min-h-[400px] text-base leading-relaxed [&>p]:mb-4'} [&>strong]:font-bold [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>code]:bg-muted [&>code]:px-1 [&>code]:rounded`,
        spellcheck: 'true',
        'data-gramm': 'true',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    }
  });

  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  if (minimal) {
    return (
      <div className="w-full bg-muted border rounded-md outline-none focus-within:border-primary/50 nodrag overflow-y-auto max-h-[160px] cursor-text">
        <div className="p-2">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden h-full flex flex-col">
      <div className="bg-muted px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
        <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            System Prompt Editor
        </span>
      </div>
      <div className="p-8 flex-1 overflow-auto bg-background cursor-text">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
