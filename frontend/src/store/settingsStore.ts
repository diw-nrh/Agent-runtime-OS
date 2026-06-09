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

export interface CustomMcpTool {
  id: string;
  name: string;
  description?: string;
  type: 'stdio' | 'sse';
  config: {
    url?: string; // For SSE
    command?: string; // For Stdio
    args?: string[]; // For Stdio
  };
}

export interface ProjectSettings {
  connections: AIConnection[];
  linkedTools: any[]; // Tools linked from the global marketplace
  customTools: CustomMcpTool[]; // Private tools created in this project
}

interface SettingsState {
  projects: Record<string, ProjectSettings>;
  
  // AI Connection Actions
  addConnection: (projectId: string, connection: AIConnection) => void;
  updateConnection: (projectId: string, connectionId: string, updates: Partial<AIConnection>) => void;
  deleteConnection: (projectId: string, connectionId: string) => void;
  
  // MCP Tool Actions
  linkTool: (projectId: string, tool: any) => void;
  unlinkTool: (projectId: string, toolId: string) => void;
  
  addCustomTool: (projectId: string, tool: CustomMcpTool) => void;
  updateCustomTool: (projectId: string, toolId: string, updates: Partial<CustomMcpTool>) => void;
  deleteCustomTool: (projectId: string, toolId: string) => void;

  getProjectSettings: (projectId: string) => ProjectSettings;
  clearProjectSettings: (projectId: string) => void;
}

const defaultSettings: ProjectSettings = {
  connections: [],
  linkedTools: [],
  customTools: [],
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
      
      linkTool: (projectId, tool) => set((state) => {
        const proj = state.projects[projectId] || { ...defaultSettings };
        // Check if already linked
        if (proj.linkedTools?.some(t => t.id === tool.id)) return state;
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              linkedTools: [...(proj.linkedTools || []), tool]
            }
          }
        };
      }),

      unlinkTool: (projectId, toolId) => set((state) => {
        const proj = state.projects[projectId];
        if (!proj) return state;
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              linkedTools: (proj.linkedTools || []).filter(t => t.id !== toolId)
            }
          }
        };
      }),
      
      addCustomTool: (projectId, tool) => set((state) => {
        const proj = state.projects[projectId] || { ...defaultSettings };
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              customTools: [...(proj.customTools || []), tool]
            }
          }
        };
      }),

      updateCustomTool: (projectId, toolId, updates) => set((state) => {
        const proj = state.projects[projectId];
        if (!proj) return state;
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              customTools: (proj.customTools || []).map(t => 
                t.id === toolId ? { ...t, ...updates } : t
              )
            }
          }
        };
      }),

      deleteCustomTool: (projectId, toolId) => set((state) => {
        const proj = state.projects[projectId];
        if (!proj) return state;
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              customTools: (proj.customTools || []).filter(t => t.id !== toolId)
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
