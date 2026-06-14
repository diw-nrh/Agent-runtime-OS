import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { MentionList } from './MentionList';
import { MentionListRef } from '@/types/notebook';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { Editor, Range } from '@tiptap/core';
import { useSettingsStore } from '@/store/settingsStore';

export const forceToolSuggestionPluginKey = new PluginKey('forceToolSuggestion');

export function createForceToolSuggestion(projectId: string, onAddTool?: (toolId: string) => void) {
  return {
    pluginKey: forceToolSuggestionPluginKey,
    char: '[',
    allowedPrefixes: [' ', ''],
    items: ({ query }: { query: string }) => {
      // Fetch dynamic tools from Zustand store
      const projSettings = useSettingsStore.getState().getProjectSettings(projectId);
      const allProjectTools = [...(projSettings.linkedTools || []), ...(projSettings.customTools || [])];
      
      // Extract REAL tools from toolPermissions keys
      let realTools: string[] = [];
      allProjectTools.forEach(tool => {
        if (tool.toolPermissions) {
          realTools.push(...Object.keys(tool.toolPermissions));
        }
      });
      // Deduplicate
      realTools = Array.from(new Set(realTools));
      
      // If toolPermissions is empty, fallback to folder names just in case, but real tools are preferred
      if (realTools.length === 0) {
         realTools = allProjectTools.map(t => t.name);
      }
      
      return realTools
        .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);
    },

    command: ({ editor, range, props }: { editor: Editor, range: Range, props: { id: string | null, label?: string | null } }) => {
      const p = props as unknown as { id: string; name: string; description: string };
      // Standard Tiptap mention insertion
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'forceToolMention',
            attrs: {
              id: p.id,
              label: p.name,
              description: p.description
            },
          }
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
          return (component.ref as { onKeyDown: (props: SuggestionKeyDownProps) => boolean })?.onKeyDown(props) || false;
        },

        onExit() {
          popup[0].destroy();
          component.destroy();
        },
      };
    },
  };
}
