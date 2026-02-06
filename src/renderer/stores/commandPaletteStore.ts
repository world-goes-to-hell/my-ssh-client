import { create } from 'zustand'

export interface CommandItem {
  id: string
  title: string
  subtitle?: string
  category: 'connection' | 'command' | 'settings' | 'recent' | 'history' | 'snippet'
  icon?: string
  shortcut?: string
  action: () => void
  keywords?: string[]
}

interface CommandPaletteState {
  isOpen: boolean
  query: string
  selectedIndex: number
  recentCommands: string[]
  open: () => void
  close: () => void
  toggle: () => void
  setQuery: (query: string) => void
  setSelectedIndex: (index: number) => void
  addRecentCommand: (id: string) => void
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  isOpen: false,
  query: '',
  selectedIndex: 0,
  recentCommands: JSON.parse(localStorage.getItem('recentCommands') || '[]'),

  open: () => set({ isOpen: true, query: '', selectedIndex: 0 }),
  close: () => set({ isOpen: false, query: '', selectedIndex: 0 }),
  toggle: () => {
    const { isOpen } = get()
    if (isOpen) {
      set({ isOpen: false, query: '', selectedIndex: 0 })
    } else {
      set({ isOpen: true, query: '', selectedIndex: 0 })
    }
  },
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  addRecentCommand: (id) => {
    const { recentCommands } = get()
    const updated = [id, ...recentCommands.filter(c => c !== id)].slice(0, 5)
    localStorage.setItem('recentCommands', JSON.stringify(updated))
    set({ recentCommands: updated })
  },
}))
