export const SESSION_COLORS = [
  { id: 'red', name: '빨강', color: '#ef4444' },
  { id: 'orange', name: '주황', color: '#f97316' },
  { id: 'amber', name: '노랑', color: '#f59e0b' },
  { id: 'green', name: '초록', color: '#22c55e' },
  { id: 'teal', name: '청록', color: '#14b8a6' },
  { id: 'blue', name: '파랑', color: '#3b82f6' },
  { id: 'purple', name: '보라', color: '#a855f7' },
  { id: 'pink', name: '분홍', color: '#ec4899' },
] as const

export type SessionColorId = typeof SESSION_COLORS[number]['id']
