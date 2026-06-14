export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'approval';
  content: string;
  timestamp: Date;
}

export interface PlaygroundAgent {
  id: string;
  name: string;
  status: 'online' | 'offline';
  isSystemIO?: boolean;
}
