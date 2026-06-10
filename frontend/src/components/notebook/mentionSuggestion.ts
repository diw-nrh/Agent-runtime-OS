import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { MentionList } from './MentionList';
import { MentionListRef } from '@/types/notebook';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { useSettingsStore } from '@/store/settingsStore';

export function createMentionSuggestion(projectId: string, onAddTool?: (toolId: string) => void) {
  return {
    items: ({ query }: { query: string }) => {
      // Fetch dynamic tools from Zustand store
      const projSettings = useSettingsStore.getState().getProjectSettings(projectId);
      const allProjectTools = [...(projSettings.linkedTools || []), ...(projSettings.customTools || [])];
      
      const items = allProjectTools.map(t => t.name);
      
      return items
        .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);
    },

    command: ({ editor, range, props }: any) => {
      // Standard Tiptap mention insertion
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'mention',
            attrs: props,
          },
          {
            type: 'text',
            text: ' ',
          },
        ])
        .run();

      // Trigger the side-effect to attach the tool to the agent config
      if (onAddTool) {
        const projSettings = useSettingsStore.getState().getProjectSettings(projectId);
        const allProjectTools = [...(projSettings.linkedTools || []), ...(projSettings.customTools || [])];
        const matchedTool = allProjectTools.find(t => t.name === props.id);
        if (matchedTool) {
          onAddTool(matchedTool.id);
        }
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
}
