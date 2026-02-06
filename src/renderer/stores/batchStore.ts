import { create } from 'zustand'

export interface BatchResult {
  sessionId: string
  sessionName: string
  host: string
  status: 'pending' | 'running' | 'success' | 'error'
  stdout: string
  stderr: string
  exitCode?: number
  duration?: number  // ms
}

export interface BatchJob {
  id: string
  command: string
  createdAt: number
  results: BatchResult[]
}

interface BatchState {
  jobs: BatchJob[]
  isRunning: boolean

  addJob: (job: BatchJob) => void
  updateResult: (jobId: string, sessionId: string, update: Partial<BatchResult>) => void
  setRunning: (running: boolean) => void
  clearJobs: () => void
  removeJob: (jobId: string) => void
}

export const useBatchStore = create<BatchState>((set) => ({
  jobs: [],
  isRunning: false,

  addJob: (job) => set((state) => ({
    jobs: [job, ...state.jobs].slice(0, 50)  // Keep last 50 jobs
  })),

  updateResult: (jobId, sessionId, update) => set((state) => ({
    jobs: state.jobs.map(job =>
      job.id === jobId
        ? {
            ...job,
            results: job.results.map(r =>
              r.sessionId === sessionId ? { ...r, ...update } : r
            )
          }
        : job
    )
  })),

  setRunning: (running) => set({ isRunning: running }),
  clearJobs: () => set({ jobs: [] }),
  removeJob: (jobId) => set((state) => ({
    jobs: state.jobs.filter(j => j.id !== jobId)
  }))
}))
