import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarMode: 'compact' | 'expanded'
  zenMode: boolean
  setSidebarMode: (mode: 'compact' | 'expanded') => void
  toggleSidebarMode: () => void
  setZenMode: (enabled: boolean) => void
  toggleZenMode: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarMode: 'expanded',
      zenMode: false,
      setSidebarMode: (mode) => set({ sidebarMode: mode }),
      toggleSidebarMode: () => set((state) => ({
        sidebarMode: state.sidebarMode === 'compact' ? 'expanded' : 'compact'
      })),
      setZenMode: (enabled) => set({ zenMode: enabled }),
      toggleZenMode: () => set((state) => ({ zenMode: !state.zenMode })),
    }),
    { name: 'ui-store' }
  )
)
