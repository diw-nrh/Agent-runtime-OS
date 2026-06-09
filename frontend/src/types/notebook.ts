export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface MentionListProps {
  items: string[];
  command: (props: { id: string }) => void;
}
