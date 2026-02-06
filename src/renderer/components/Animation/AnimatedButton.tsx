import { motion, HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { SPRINGS } from '../../lib/animation/config'

interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode
}

export const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ children, className, disabled, ...props }, ref) => {
    const reducedMotion = useReducedMotion()

    const motionProps = reducedMotion ? {} : {
      whileHover: disabled ? undefined : { scale: 1.02 },
      whileTap: disabled ? undefined : { scale: 0.98 },
      transition: SPRINGS.snappy,
    }

    return (
      <motion.button
        ref={ref}
        className={className}
        disabled={disabled}
        {...motionProps}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)

AnimatedButton.displayName = 'AnimatedButton'
