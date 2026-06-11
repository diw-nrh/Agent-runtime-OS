import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import { MentionListProps, MentionListRef } from '@/types/notebook';

export const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item });
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
    <div className="bg-popover text-popover-foreground border shadow-md rounded-md overflow-hidden flex flex-col p-1 w-48 z-[99999]">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-left w-full transition-colors ${
              index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
            }`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <span className="w-4 h-4 flex items-center justify-center bg-primary/20 text-primary rounded-full text-xs font-bold">@</span>
            {item}
          </button>
        ))
      ) : (
        <div className="p-2 text-sm text-muted-foreground text-center">No tools found</div>
      )}
    </div>
  );
});
MentionList.displayName = 'MentionList';
