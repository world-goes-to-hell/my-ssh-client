import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Snippet {
  id: string
  name: string
  description?: string
  command: string
  category?: string
  createdAt: string
}

interface SnippetState {
  snippets: Snippet[]
  addSnippet: (snippet: Omit<Snippet, 'id' | 'createdAt'>) => void
  updateSnippet: (id: string, updates: Partial<Snippet>) => void
  deleteSnippet: (id: string) => void
  getSnippetsByCategory: (category: string) => Snippet[]
  expandVariables: (command: string, context: Record<string, string>) => string
}

// Default snippets
const DEFAULT_SNIPPETS: Snippet[] = [
  {
    id: crypto.randomUUID(),
    name: 'List files',
    description: 'List all files with details',
    command: 'ls -la',
    category: 'File System',
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    name: 'Disk usage',
    description: 'Show disk usage in human-readable format',
    command: 'df -h',
    category: 'System Info',
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    name: 'Memory info',
    description: 'Show memory usage',
    command: 'free -h',
    category: 'System Info',
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    name: 'Process list',
    description: 'List all running processes',
    command: 'ps aux',
    category: 'Process',
    createdAt: new Date().toISOString()
  },
  {
    id: crypto.randomUUID(),
    name: 'Network connections',
    description: 'Show network connections',
    command: 'netstat -tuln',
    category: 'Network',
    createdAt: new Date().toISOString()
  }
]

export const useSnippetStore = create<SnippetState>()(
  persist(
    (set, get) => ({
      snippets: DEFAULT_SNIPPETS,

      addSnippet: (snippet) => set((state) => ({
        snippets: [
          ...state.snippets,
          {
            ...snippet,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString()
          }
        ]
      })),

      updateSnippet: (id, updates) => set((state) => ({
        snippets: state.snippets.map(s =>
          s.id === id ? { ...s, ...updates } : s
        )
      })),

      deleteSnippet: (id) => set((state) => ({
        snippets: state.snippets.filter(s => s.id !== id)
      })),

      getSnippetsByCategory: (category) => {
        return get().snippets.filter(s => s.category === category)
      },

      expandVariables: (command, context) => {
        let expanded = command

        // Built-in variables
        const now = new Date()
        const variables: Record<string, string> = {
          date: now.toLocaleDateString(),
          time: now.toLocaleTimeString(),
          timestamp: now.getTime().toString(),
          ...context
        }

        // Replace all variables in format ${varname}
        Object.entries(variables).forEach(([key, value]) => {
          const regex = new RegExp(`\\$\\{${key}\\}`, 'g')
          expanded = expanded.replace(regex, value)
        })

        return expanded
      }
    }),
    {
      name: 'snippet-storage'
    }
  )
)
