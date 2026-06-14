import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { SkillMentionList } from './SkillMentionList';
import { MentionListRef } from '@/types/notebook';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import { Editor, Range } from '@tiptap/core';
import { useSettingsStore } from '@/store/settingsStore';

export const skillSuggestionPluginKey = new PluginKey('skillSuggestion');

export function createSkillSuggestion(projectId: string) {
  return {
    pluginKey: skillSuggestionPluginKey,
    char: '~', // Trigger character for Skills
    items: ({ query }: { query: string }) => {
      // Fetch dynamic skills from Zustand store
      const projSettings = useSettingsStore.getState().getProjectSettings(projectId);
      const skills = projSettings.skills || [];
      
      return skills
        .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);
    },

    command: ({ editor, range, props }: { editor: Editor, range: Range, props: { id: string | null, label?: string | null } }) => {
      const p = props as unknown as { id: string; name: string };
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          {
            type: 'skillMention',
            attrs: {
              id: p.id,
              label: p.name,
            },
          },
          {
            type: 'text',
            text: ' ',
          },
        ])
        .run();
    },

    render: () => {
      let component: ReactRenderer;
      let popup: TippyInstance[];

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(SkillMentionList, {
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
