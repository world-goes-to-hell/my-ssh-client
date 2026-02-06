import { create } from 'zustand'

export interface ServerMetrics {
  timestamp: number
  cpu: {
    usage: number  // 0-100%
    cores: number
    loadAvg: string  // "0.5, 0.3, 0.2"
  }
  memory: {
    total: number   // MB
    used: number    // MB
    free: number    // MB
    usage: number   // 0-100%
  }
  disk: {
    filesystems: Array<{
      name: string
      size: string
      used: string
      avail: string
      usage: number  // 0-100%
      mount: string
    }>
  }
  uptime: string
}

interface MonitorState {
  metrics: Map<string, ServerMetrics>  // sessionId -> latest metrics
  history: Map<string, ServerMetrics[]>  // sessionId -> last 30 metrics
  monitoring: Set<string>  // sessionIds being monitored

  setMetrics: (sessionId: string, metrics: ServerMetrics) => void
  startMonitoring: (sessionId: string) => void
  stopMonitoring: (sessionId: string) => void
  clearMetrics: (sessionId: string) => void
  isMonitoring: (sessionId: string) => boolean
}

const MAX_HISTORY = 30

export const useMonitorStore = create<MonitorState>((set, get) => ({
  metrics: new Map(),
  history: new Map(),
  monitoring: new Set(),

  setMetrics: (sessionId, metrics) => set((state) => {
    const newMetrics = new Map(state.metrics)
    newMetrics.set(sessionId, metrics)

    const newHistory = new Map(state.history)
    const existing = newHistory.get(sessionId) || []
    newHistory.set(sessionId, [...existing.slice(-MAX_HISTORY + 1), metrics])

    return { metrics: newMetrics, history: newHistory }
  }),

  startMonitoring: (sessionId) => set((state) => {
    const newMonitoring = new Set(state.monitoring)
    newMonitoring.add(sessionId)
    return { monitoring: newMonitoring }
  }),

  stopMonitoring: (sessionId) => set((state) => {
    const newMonitoring = new Set(state.monitoring)
    newMonitoring.delete(sessionId)
    return { monitoring: newMonitoring }
  }),

  clearMetrics: (sessionId) => set((state) => {
    const newMetrics = new Map(state.metrics)
    const newHistory = new Map(state.history)
    newMetrics.delete(sessionId)
    newHistory.delete(sessionId)
    const newMonitoring = new Set(state.monitoring)
    newMonitoring.delete(sessionId)
    return { metrics: newMetrics, history: newHistory, monitoring: newMonitoring }
  }),

  isMonitoring: (sessionId) => get().monitoring.has(sessionId)
}))

// Parse server metrics from command outputs
export function parseMetrics(cpuOutput: string, memOutput: string, diskOutput: string, uptimeOutput: string): ServerMetrics {
  const metrics: ServerMetrics = {
    timestamp: Date.now(),
    cpu: { usage: 0, cores: 0, loadAvg: '' },
    memory: { total: 0, used: 0, free: 0, usage: 0 },
    disk: { filesystems: [] },
    uptime: ''
  }

  // Parse CPU from top -bn1
  try {
    const cpuLine = cpuOutput.split('\n').find(l => l.includes('Cpu') || l.includes('%Cpu'))
    if (cpuLine) {
      const idleMatch = cpuLine.match(/([\d.]+)\s*(?:id|%?\s*id)/)
      if (idleMatch) {
        metrics.cpu.usage = Math.round((100 - parseFloat(idleMatch[1])) * 10) / 10
      }
    }
    // cores from nproc in cpuOutput or count processors
    const coresMatch = cpuOutput.match(/(\d+)\s*$/)
    if (coresMatch) {
      metrics.cpu.cores = parseInt(coresMatch[1])
    }
  } catch {}

  // Parse load average from uptime
  try {
    const loadMatch = uptimeOutput.match(/load average[s]?:\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
    if (loadMatch) {
      metrics.cpu.loadAvg = `${loadMatch[1]}, ${loadMatch[2]}, ${loadMatch[3]}`
    }
    // Parse uptime
    const upMatch = uptimeOutput.match(/up\s+(.+?),\s+\d+\s+user/)
    if (upMatch) {
      metrics.uptime = upMatch[1].trim()
    }
  } catch {}

  // Parse memory from free -m
  try {
    const memLines = memOutput.split('\n')
    const memLine = memLines.find(l => l.startsWith('Mem:'))
    if (memLine) {
      const parts = memLine.split(/\s+/)
      metrics.memory.total = parseInt(parts[1]) || 0
      metrics.memory.used = parseInt(parts[2]) || 0
      metrics.memory.free = parseInt(parts[3]) || 0
      metrics.memory.usage = metrics.memory.total > 0
        ? Math.round((metrics.memory.used / metrics.memory.total) * 1000) / 10
        : 0
    }
  } catch {}

  // Parse disk from df -h
  try {
    const diskLines = diskOutput.split('\n').slice(1) // skip header
    for (const line of diskLines) {
      const parts = line.split(/\s+/)
      if (parts.length >= 6 && parts[0] !== 'tmpfs' && parts[0] !== 'devtmpfs' && !parts[0].includes('loop')) {
        const usageStr = parts[4].replace('%', '')
        metrics.disk.filesystems.push({
          name: parts[0],
          size: parts[1],
          used: parts[2],
          avail: parts[3],
          usage: parseInt(usageStr) || 0,
          mount: parts[5]
        })
      }
    }
  } catch {}

  return metrics
}

// Fetch metrics for a session
export async function fetchMetrics(sessionId: string): Promise<ServerMetrics | null> {
  try {
    const [cpuResult, memResult, diskResult, uptimeResult] = await Promise.all([
      window.electronAPI.sshExecCommand(sessionId, 'top -bn1 | head -5; echo "---"; nproc'),
      window.electronAPI.sshExecCommand(sessionId, 'free -m'),
      window.electronAPI.sshExecCommand(sessionId, 'df -h'),
      window.electronAPI.sshExecCommand(sessionId, 'uptime')
    ])

    if (!cpuResult.success || !memResult.success || !diskResult.success) {
      return null
    }

    return parseMetrics(
      cpuResult.stdout || '',
      memResult.stdout || '',
      diskResult.stdout || '',
      uptimeResult.stdout || ''
    )
  } catch {
    return null
  }
}
