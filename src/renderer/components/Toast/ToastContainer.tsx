import { AnimatePresence } from 'framer-motion'
import { useToastStore } from '../../stores/toastStore'
import { Toast } from './Toast'
import './Toast.css'

export function ToastContainer() {
  const { toasts, position } = useToastStore()

  return (
    <div
      className={`toast-container toast-${position}`}
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  )
}
