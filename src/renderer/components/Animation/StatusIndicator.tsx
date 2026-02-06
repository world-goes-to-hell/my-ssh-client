import { motion } from 'framer-motion'
import './StatusIndicator.css'

type Status = 'connected' | 'connecting' | 'disconnected' | 'error'

interface StatusIndicatorProps {
  status: Status
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const statusConfig = {
  connected: { color: 'var(--success)', label: '연결됨', pulse: false },
  connecting: { color: 'var(--warning)', label: '연결 중...', pulse: true },
  disconnected: { color: 'var(--text-muted)', label: '연결 안됨', pulse: false },
  error: { color: 'var(--error)', label: '오류', pulse: true }
}

export function StatusIndicator({ status, size = 'md', showLabel = false }: StatusIndicatorProps) {
  const config = statusConfig[status]

  return (
    <div className={`status-indicator size-${size}`}>
      <motion.span
        className={`status-dot ${config.pulse ? 'pulse' : ''}`}
        style={{ backgroundColor: config.color }}
        animate={config.pulse ? { scale: [1, 1.2, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
      {showLabel && <span className="status-label">{config.label}</span>}
    </div>
  )
}
