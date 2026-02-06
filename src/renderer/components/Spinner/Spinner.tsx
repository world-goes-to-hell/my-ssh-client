import './Spinner.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const pixelSize = sizeMap[size]

  return (
    <div
      className={`spinner spinner-${size} ${className}`}
      style={{
        width: pixelSize,
        height: pixelSize
      }}
      role="status"
      aria-label="Loading"
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle
          className="spinner-track"
          cx="12"
          cy="12"
          r="10"
          strokeWidth="3"
        />
        <circle
          className="spinner-indicator"
          cx="12"
          cy="12"
          r="10"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
