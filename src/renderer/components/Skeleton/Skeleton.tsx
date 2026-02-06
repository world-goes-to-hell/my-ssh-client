import './Skeleton.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
}

export function Skeleton({
  width = '100%',
  height = '1em',
  borderRadius = 'var(--radius-sm)',
  className = ''
}: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius
      }}
    />
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height="0.875em"
          className="skeleton-line"
        />
      ))}
    </div>
  )
}

export function SkeletonSessionItem() {
  return (
    <div className="skeleton-session-item">
      <Skeleton width={32} height={32} borderRadius="var(--radius-md)" />
      <div className="skeleton-session-content">
        <Skeleton width="70%" height="0.875em" />
        <Skeleton width="40%" height="0.75em" />
      </div>
    </div>
  )
}
