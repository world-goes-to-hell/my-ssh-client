import './TagBadge.css'

interface TagBadgeProps {
  name: string
  color: string
  size?: 'sm' | 'md'
  onRemove?: () => void
}

export function TagBadge({ name, color, size = 'md', onRemove }: TagBadgeProps) {
  return (
    <span
      className={`tag-badge tag-badge-${size}`}
      style={{
        backgroundColor: `${color}20`,
        borderColor: color,
        color: color
      }}
    >
      <span className="tag-badge-name">{name}</span>
      {onRemove && (
        <button
          className="tag-badge-remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove ${name} tag`}
        >
          ×
        </button>
      )}
    </span>
  )
}
