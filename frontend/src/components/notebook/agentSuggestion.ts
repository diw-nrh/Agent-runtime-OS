import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { AgentMentionList } from './AgentMentionList';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

export const agentSuggestionPluginKey = new PluginKey('agentSuggestion');

export function createAgentSuggestion(
  availableAgents: any[], 
  onAddAgentConnection?: (targetId: string) => void
) {
  return {
    pluginKey: agentSuggestionPluginKey,
    char: '#',
    items: ({ query }: { query: string }) => {
      const filtered = availableAgents
        .filter((agent) => (agent.data?.label || '').toLowerCase().includes(query.toLowerCase()))
        .map(agent => ({
          id: agent.id,
          label: agent.data?.label || 'Unknown Agent',
          system_prompt: agent.data?.system_prompt || ''
        }))
        .slice(0, 5);
        
      if (filtered.length === 0) {
        return [{ id: 'NONE', label: 'No agents available', system_prompt: '' }];
      }
      return filtered;
    },

    command: ({ editor, range, props }: any) => {
      // We insert our custom agentDelegate node instead of standard mention
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'agentDelegate',
            attrs: {
              agentId: props.id,
              agentName: props.label,
              agentDesc: props.system_prompt
            },
          },
          {
            type: 'text',
            text: ' ',
          },
        ])
        .run();

      // Trigger side-effect to automatically connect the agent in Canvas
      if (onAddAgentConnection) {
        onAddAgentConnection(props.id);
      }
    },

    render: () => {
      let component: ReactRenderer;
      let popup: TippyInstance[];

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(AgentMentionList, {
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
          return (component.ref as any)?.onKeyDown(props) || false;
        },

        onExit() {
          popup[0].destroy();
          component.destroy();
        },
      };
    },
  };
}
