// Animation timing constants matching CSS variables
export const TIMING = {
  fast: 0.1,
  base: 0.2,
  slow: 0.3,
} as const

// Spring configurations for framer-motion
export const SPRINGS = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  snappy: { type: 'spring', stiffness: 400, damping: 30 },
  bouncy: { type: 'spring', stiffness: 300, damping: 10 },
} as const

// Easing functions
export const EASING = {
  easeOut: [0.4, 0, 0.2, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  anticipate: [0.68, -0.55, 0.265, 1.55],
} as const
