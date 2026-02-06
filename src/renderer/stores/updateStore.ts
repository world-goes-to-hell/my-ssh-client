import { create } from 'zustand'

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'

export interface UpdateInfo {
  status: UpdateStatus
  version?: string
  releaseDate?: string
  releaseNotes?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  errorMessage?: string
}

interface UpdateState {
  info: UpdateInfo
  dismissed: boolean
  appVersion: string

  setInfo: (info: Partial<UpdateInfo>) => void
  setDismissed: (dismissed: boolean) => void
  setAppVersion: (version: string) => void
  reset: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  info: { status: 'idle' },
  dismissed: false,
  appVersion: '1.0.0',

  setInfo: (info) => set((state) => ({
    info: { ...state.info, ...info },
    dismissed: false
  })),

  setDismissed: (dismissed) => set({ dismissed }),
  setAppVersion: (appVersion) => set({ appVersion }),
  reset: () => set({ info: { status: 'idle' }, dismissed: false })
}))
