import { useReducedMotion } from './useReducedMotion'
import { TIMING, SPRINGS } from '../lib/animation/config'

interface SpringConfig {
  type: 'spring'
  stiffness: number
  damping: number
}

interface AnimationConfig {
  duration: number
  spring: SpringConfig
  enabled: boolean
}

export function useAnimationConfig(): AnimationConfig {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return {
      duration: 0,
      spring: { type: 'spring' as const, stiffness: 1000, damping: 100 },
      enabled: false,
    }
  }

  return {
    duration: TIMING.base,
    spring: SPRINGS.gentle,
    enabled: true,
  }
}
