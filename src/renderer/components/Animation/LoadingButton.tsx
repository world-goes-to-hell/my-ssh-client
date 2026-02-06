import { forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { SPRINGS } from '../../lib/animation/config'
import { useRipple } from './Ripple'
import './LoadingButton.css'

interface LoadingButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode
  isLoading?: boolean
  loadingText?: string
  rippleColor?: string
}

export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, isLoading = false, loadingText = '로딩 중...', rippleColor, className, disabled, onClick, ...props }, ref) => {
    const reducedMotion = useReducedMotion()
    const { createRipple, RippleContainer } = useRipple(rippleColor)

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isLoading && !disabled) {
        createRipple(e)
        onClick?.(e)
      }
    }

    const motionProps = reducedMotion ? {} : {
      whileHover: disabled || isLoading ? undefined : { scale: 1.02 },
      whileTap: disabled || isLoading ? undefined : { scale: 0.98 },
      transition: SPRINGS.snappy,
    }

    return (
      <motion.button
        ref={ref}
        className={`loading-button ${className || ''} ${isLoading ? 'is-loading' : ''}`}
        disabled={disabled || isLoading}
        onClick={handleClick}
        {...motionProps}
        {...props}
      >
        {isLoading && (
          <span className="loading-spinner">
            <span className="spinner-dot"></span>
            <span className="spinner-dot"></span>
            <span className="spinner-dot"></span>
          </span>
        )}
        <span className={isLoading ? 'loading-text-hidden' : ''}>
          {isLoading ? loadingText : children}
        </span>
        <RippleContainer />
      </motion.button>
    )
  }
)

LoadingButton.displayName = 'LoadingButton'
