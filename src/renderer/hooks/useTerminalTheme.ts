import { useEffect, useCallback } from 'react'
import { Terminal } from 'xterm'
import { useThemeStore } from '../stores/themeStore'

/**
 * Hook to synchronize terminal theme with the global theme store.
 * Call this in components that create Terminal instances.
 */
export function useTerminalTheme(terminalInstance: Terminal | null) {
  const getTerminalTheme = useThemeStore(state => state.getTerminalTheme)

  const applyTheme = useCallback(() => {
    if (!terminalInstance) return

    const theme = getTerminalTheme()
    terminalInstance.options.theme = theme
  }, [terminalInstance, getTerminalTheme])

  useEffect(() => {
    // Apply initial theme
    applyTheme()

    // Listen for theme changes
    const handleThemeChange = () => {
      applyTheme()
    }

    window.addEventListener('theme-changed', handleThemeChange)

    return () => {
      window.removeEventListener('theme-changed', handleThemeChange)
    }
  }, [applyTheme])

  return { applyTheme }
}

/**
 * Get current terminal theme colors (for use outside React components)
 */
export function getCurrentTerminalTheme() {
  return useThemeStore.getState().getTerminalTheme()
}
