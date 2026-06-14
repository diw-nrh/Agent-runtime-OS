import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Bot } from 'lucide-react';
import { SuggestionKeyDownProps } from '@tiptap/suggestion';

export interface AgentMentionItem {
  id: string;
  label: string;
  system_prompt: string;
}

interface AgentMentionListProps {
  items: AgentMentionItem[];
  command: (item: AgentMentionItem) => void;
}

export const AgentMentionList = forwardRef<{ onKeyDown: (props: SuggestionKeyDownProps) => boolean }, AgentMentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item && item.id !== 'NONE') {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-popover text-popover-foreground border shadow-md rounded-md overflow-hidden flex flex-col w-64 z-[99999]">
      <div className="bg-muted/50 px-3 py-1.5 border-b text-xs font-semibold text-muted-foreground">
        Select Agent to Delegate
      </div>
      <div className="p-1 max-h-64 overflow-y-auto">
        {props.items.length > 0 && props.items[0].id === 'NONE' ? (
          <div className="p-2 text-sm text-muted-foreground text-center">No other agents found</div>
        ) : props.items.length ? (
          props.items.map((item, index) => (
            <button
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-left w-full transition-colors ${
                index === selectedIndex ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-muted'
              }`}
              key={index}
              onClick={() => selectItem(index)}
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))
        ) : null}
      </div>
    </div>
  );
});
AgentMentionList.displayName = 'AgentMentionList';
