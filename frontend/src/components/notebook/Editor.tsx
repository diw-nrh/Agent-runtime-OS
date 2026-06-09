"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import suggestion from './mentionSuggestion';

interface NotebookEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
}

export function NotebookEditor({ initialContent, onChange }: NotebookEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Mention.configure({
        HTMLAttributes: {
          class: 'bg-primary/20 text-primary px-1 rounded-md font-medium cursor-pointer',
        },
        suggestion,
      }),
    ],
    immediatelyRender: false,
    content: initialContent || '<p>Start writing your <strong>Agent System Prompt</strong> here...</p><p>Type <code>@</code> to attach an MCP Tool.</p>',
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[400px] text-base leading-relaxed [&>p]:mb-4 [&>strong]:font-bold [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>code]:bg-muted [&>code]:px-1 [&>code]:rounded',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  return (
    <div className="border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden h-full flex flex-col">
      <div className="bg-muted px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
        <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            System Prompt Editor
        </span>
      </div>
      <div className="p-8 flex-1 overflow-auto bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
