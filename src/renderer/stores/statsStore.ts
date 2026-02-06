import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SessionRecord {
  id: string
  sessionName: string
  host: string
  username: string
  connectedAt: number  // timestamp ms
  disconnectedAt?: number  // timestamp ms
  commandCount: number
}

interface StatsState {
  records: SessionRecord[]
  addRecord: (record: Omit<SessionRecord, 'id' | 'connectedAt' | 'commandCount'>) => string
  endRecord: (id: string) => void
  incrementCommandCount: (id: string) => void
  clearRecords: () => void
  getStats: () => DashboardStats
}

export interface DashboardStats {
  totalConnections: number
  totalDuration: number  // ms
  avgDuration: number    // ms
  topHosts: { host: string; count: number; totalDuration: number }[]
  recentSessions: SessionRecord[]
  connectionsByDay: { day: string; count: number }[]
  connectionsByHour: number[]  // 24 entries
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set, get) => ({
      records: [],

      addRecord: (record) => {
        const id = `stat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const newRecord: SessionRecord = {
          ...record,
          id,
          connectedAt: Date.now(),
          commandCount: 0,
        }
        set((state) => ({
          records: [newRecord, ...state.records].slice(0, 500) // Keep last 500
        }))
        return id
      },

      endRecord: (id) => {
        set((state) => ({
          records: state.records.map(r =>
            r.id === id && !r.disconnectedAt
              ? { ...r, disconnectedAt: Date.now() }
              : r
          )
        }))
      },

      incrementCommandCount: (id) => {
        set((state) => ({
          records: state.records.map(r =>
            r.id === id ? { ...r, commandCount: r.commandCount + 1 } : r
          )
        }))
      },

      clearRecords: () => set({ records: [] }),

      getStats: () => {
        const { records } = get()
        const now = Date.now()

        // Total connections
        const totalConnections = records.length

        // Total and average duration
        const completedRecords = records.filter(r => r.disconnectedAt)
        const totalDuration = completedRecords.reduce((sum, r) =>
          sum + ((r.disconnectedAt || now) - r.connectedAt), 0)
        const avgDuration = completedRecords.length > 0
          ? totalDuration / completedRecords.length : 0

        // Top hosts
        const hostMap = new Map<string, { count: number; totalDuration: number }>()
        for (const r of records) {
          const existing = hostMap.get(r.host) || { count: 0, totalDuration: 0 }
          existing.count++
          existing.totalDuration += (r.disconnectedAt || now) - r.connectedAt
          hostMap.set(r.host, existing)
        }
        const topHosts = Array.from(hostMap.entries())
          .map(([host, data]) => ({ host, ...data }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)

        // Recent sessions (last 10)
        const recentSessions = records.slice(0, 10)

        // Connections by day (last 7 days)
        const dayNames = ['일', '월', '화', '수', '목', '금', '토']
        const connectionsByDay: { day: string; count: number }[] = []
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now - i * 86400000)
          const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
          const dayEnd = dayStart + 86400000
          const count = records.filter(r => r.connectedAt >= dayStart && r.connectedAt < dayEnd).length
          connectionsByDay.push({
            day: dayNames[date.getDay()],
            count
          })
        }

        // Connections by hour (24h)
        const connectionsByHour = new Array(24).fill(0)
        for (const r of records) {
          const hour = new Date(r.connectedAt).getHours()
          connectionsByHour[hour]++
        }

        return {
          totalConnections,
          totalDuration,
          avgDuration,
          topHosts,
          recentSessions,
          connectionsByDay,
          connectionsByHour,
        }
      },
    }),
    { name: 'ssh-session-stats' }
  )
)
