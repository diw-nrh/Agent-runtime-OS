import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { MentionList } from './MentionList';
import { MentionListRef } from '@/types/notebook';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';

const mentionSuggestion = {
  items: async ({ query }: { query: string }) => {
    try {
      // Fetch dynamic tools from Python MCP Gateway
      const response = await fetch('http://localhost:8000/api/mcp/tools');
      if (!response.ok) throw new Error("Network response was not ok");
      
      const data = await response.json();
      const items = data.tools.map((t: { id: string }) => t.id) as string[];
      
      return items
        .filter((item) => item.toLowerCase().startsWith(query.toLowerCase()))
        .slice(0, 5);
    } catch (e) {
      console.error("Failed to fetch MCP tools, using fallback.", e);
      // Fallback in case backend is offline
      const fallbackItems = ['offline-github', 'offline-search'];
      return fallbackItems.filter(i => i.startsWith(query.toLowerCase())).slice(0, 5);
    }
  },

  render: () => {
    let component: ReactRenderer;
    let popup: TippyInstance[];

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: SuggestionProps) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        return (component.ref as MentionListRef)?.onKeyDown(props) || false;
      },

      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
};

export default mentionSuggestion;
