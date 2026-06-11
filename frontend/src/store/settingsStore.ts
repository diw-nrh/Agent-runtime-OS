import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AIProviderType = 'openai-compatible' | 'anthropic' | 'google' | 'local';

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
  globalPermission?: 'allow' | 'ask' | 'block' | 'custom';
  toolPermissions?: Record<string, 'allow' | 'ask' | 'block'>;
}

export interface ExecutionSettings {
  enableGlobalLimits: boolean;
  maxTokensPerRun: number;
  maxIterations: number;
  enableFaultTolerance: boolean;
}

export interface Skill {
  id: string;
  name: string;
  content: string;
}

export interface ProjectSettings {
  connections: AIConnection[];
  linkedTools: any[]; // Tools linked from the global marketplace (can have permissions)
  customTools: CustomMcpTool[]; // Private tools created in this project
  skills?: Skill[]; // Skills written in Markdown
  executionSettings?: ExecutionSettings;
}

interface SettingsState {
  projects: Record<string, ProjectSettings>;
  
  // AI Connection Actions
  addConnection: (projectId: string, connection: AIConnection) => void;
  updateConnection: (projectId: string, connectionId: string, updates: Partial<AIConnection>) => void;
  deleteConnection: (projectId: string, connectionId: string) => void;
  
  // MCP Tool Actions
  linkTool: (projectId: string, tool: any) => void;
  updateLinkedTool: (projectId: string, toolId: string, updates: any) => void;
  unlinkTool: (projectId: string, toolId: string) => void;
  
  addCustomTool: (projectId: string, tool: CustomMcpTool) => void;
  updateCustomTool: (projectId: string, toolId: string, updates: Partial<CustomMcpTool>) => void;
  deleteCustomTool: (projectId: string, toolId: string) => void;

  // Skill Actions
  addSkill: (projectId: string, skill: Skill) => void;
  updateSkill: (projectId: string, skillId: string, updates: Partial<Skill>) => void;
  deleteSkill: (projectId: string, skillId: string) => void;

  updateExecutionSettings: (projectId: string, settings: Partial<ExecutionSettings>) => void;

  getProjectSettings: (projectId: string) => ProjectSettings;
  clearProjectSettings: (projectId: string) => void;
}

const defaultSettings: ProjectSettings = {
  connections: [],
  linkedTools: [],
  customTools: [],
  executionSettings: {
    enableGlobalLimits: true,
    maxTokensPerRun: 100000,
    maxIterations: 25,
    enableFaultTolerance: false,
  }
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
        
        const toolWithPerms = { ...tool, globalPermission: 'allow' };
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              linkedTools: [...(proj.linkedTools || []), toolWithPerms]
            }
          }
        };
      }),
      
      updateLinkedTool: (projectId, toolId, updates) => set((state) => {
        const project = state.projects[projectId];
        if (!project) return state;
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...project,
              linkedTools: project.linkedTools.map(t => 
                t.id === toolId ? { ...t, ...updates } : t
              )
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

      addSkill: (projectId, skill) => set((state) => {
        const proj = state.projects[projectId] || { ...defaultSettings };
        const skills = proj.skills || [];
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              skills: [...skills, skill]
            }
          }
        };
      }),

      updateSkill: (projectId, skillId, updates) => set((state) => {
        const proj = state.projects[projectId];
        if (!proj || !proj.skills) return state;
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              skills: proj.skills.map(s => s.id === skillId ? { ...s, ...updates } : s)
            }
          }
        };
      }),

      deleteSkill: (projectId, skillId) => set((state) => {
        const proj = state.projects[projectId];
        if (!proj || !proj.skills) return state;
        
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              skills: proj.skills.filter(s => s.id !== skillId)
            }
          }
        };
      }),
      
      updateExecutionSettings: (projectId, settings) => set((state) => {
        const proj = state.projects[projectId] || { ...defaultSettings };
        return {
          projects: {
            ...state.projects,
            [projectId]: {
              ...proj,
              executionSettings: {
                ...(proj.executionSettings || defaultSettings.executionSettings!),
                ...settings
              }
            }
          }
        };
      }),
      
      getProjectSettings: (projectId) => {
        const proj = get().projects[projectId];
        if (!proj) return { ...defaultSettings };
        // Ensure executionSettings is populated if it's missing from old stored states
        if (!proj.executionSettings) {
          proj.executionSettings = defaultSettings.executionSettings;
        }
        return proj;
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
