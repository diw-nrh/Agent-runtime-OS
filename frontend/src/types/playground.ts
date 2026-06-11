export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

export interface PlaygroundAgent {
  id: string;
  name: string;
  status: 'online' | 'offline';
  isSystemIO?: boolean;
}
