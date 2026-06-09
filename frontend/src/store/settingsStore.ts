import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProviderType = 'openai-compatible' | 'anthropic' | 'google';

export interface AIConnection {
  id: string;          // Unique ID for the connection
  name: string;        // E.g., "My Primary OpenAI", "Local Llama 3"
  provider: AIProviderType; 
  apiKey?: string;     // For OpenAI, Groq
  baseUrl?: string;    // For Local AI
}

export interface ProjectSettings {
  connections: AIConnection[];
}

interface SettingsState {
  projects: Record<string, ProjectSettings>;
  
  // Actions
  addConnection: (projectId: string, connection: AIConnection) => void;
  updateConnection: (projectId: string, connectionId: string, updates: Partial<AIConnection>) => void;
  deleteConnection: (projectId: string, connectionId: string) => void;
  getProjectSettings: (projectId: string) => ProjectSettings;
  clearProjectSettings: (projectId: string) => void;
}

const defaultSettings: ProjectSettings = {
  connections: [],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      projects: {},
      
      addConnection: (projectId, connection) => set((state) => {
        const proj = state.projects[projectId] || { ...defaultSettings };
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              connections: [...proj.connections, connection]
            }
          }
        };
      }),

      updateConnection: (projectId, connectionId, updates) => set((state) => {
        const proj = state.projects[projectId];
        if (!proj) return state;
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              connections: proj.connections.map(c => 
                c.id === connectionId ? { ...c, ...updates } : c
              )
            }
          }
        };
      }),

      deleteConnection: (projectId, connectionId) => set((state) => {
        const proj = state.projects[projectId];
        if (!proj) return state;
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              connections: proj.connections.filter(c => c.id !== connectionId)
            }
          }
        };
      }),
      
      getProjectSettings: (projectId) => {
        return get().projects[projectId] || { ...defaultSettings };
      },
      
      clearProjectSettings: (projectId) => set((state) => {
        const newProjects = { ...state.projects };
        delete newProjects[projectId];
        return { projects: newProjects };
      }),
    }),
    {
      name: 'agentruntime-project-connections', // Renamed key to avoid conflict with old schema
    }
  )
);
