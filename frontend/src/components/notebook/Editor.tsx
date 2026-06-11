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
      SkillMention.configure({
        suggestion: createSkillSuggestion(projectId),
        HTMLAttributes: {
          class: 'bg-amber-500/20 text-amber-600 px-1 rounded-md font-medium cursor-pointer',
        },
      }),
    ],
    immediatelyRender: false,
    content: initialContent || (minimal ? '' : '<p>Start writing your <strong>Agent System Prompt</strong> here...</p><p>Type <code>@</code> to attach an MCP Tool, <code>#</code> to mention an Agent, or <code>~</code> to add a Skill.</p>'),
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
