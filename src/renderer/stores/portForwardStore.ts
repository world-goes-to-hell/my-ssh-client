import { create } from 'zustand'

export interface PortForward {
  id: string
  type: 'local' | 'remote' | 'dynamic'
  localHost: string
  localPort: number
  remoteHost: string
  remotePort: number
  connectionCount: number
}

interface PortForwardState {
  forwards: Map<string, PortForward[]> // sessionId -> forwards
  setForwards: (sessionId: string, forwards: PortForward[]) => void
  clearForwards: (sessionId: string) => void
}

export const usePortForwardStore = create<PortForwardState>((set) => ({
  forwards: new Map(),
  setForwards: (sessionId, forwards) => set((state) => {
    const newMap = new Map(state.forwards)
    newMap.set(sessionId, forwards)
    return { forwards: newMap }
  }),
  clearForwards: (sessionId) => set((state) => {
    const newMap = new Map(state.forwards)
    newMap.delete(sessionId)
    return { forwards: newMap }
  }),
}))
