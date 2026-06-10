import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { MentionListRef } from '@/types/notebook';
import { FileCode2 } from 'lucide-react';
import { Skill } from '@/store/settingsStore';

interface SkillMentionListProps {
  items: Skill[];
  command: (item: any) => void;
}

export const SkillMentionList = forwardRef<MentionListRef, SkillMentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.id, label: item.name });
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
    onKeyDown: ({ event }) => {
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

  if (!props.items.length) {
    return (
      <div className="bg-popover text-popover-foreground rounded-md shadow-md border p-2 text-sm">
        No skills found
      </div>
    );
  }

  return (
    <div className="bg-popover text-popover-foreground rounded-md shadow-md border overflow-hidden p-1 min-w-[200px]">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded-sm ${
            index === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
          }`}
          onClick={() => selectItem(index)}
        >
          <FileCode2 className="w-4 h-4 shrink-0" />
          <span className="truncate">{item.name}</span>
        </button>
      ))}
    </div>
  );
});

SkillMentionList.displayName = 'SkillMentionList';
