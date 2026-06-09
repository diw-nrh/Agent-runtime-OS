export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  author: string;
  downloads: number;
  tags: string[];
  type: 'agent' | 'tool';
}
