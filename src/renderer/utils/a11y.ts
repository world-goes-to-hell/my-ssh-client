/**
 * Accessibility utilities for screen readers and assistive technologies
 */

/**
 * Announce a message to screen readers
 * @param message - The message to announce
 * @param priority - The announcement priority ('polite' or 'assertive')
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const el = document.createElement('div')
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', priority)
  el.setAttribute('aria-atomic', 'true')
  el.className = 'sr-only'
  el.textContent = message
  document.body.appendChild(el)

  // Remove the element after screen readers have announced it
  setTimeout(() => {
    if (el.parentNode) {
      el.parentNode.removeChild(el)
    }
  }, 1000)
}

/**
 * Set the page title for screen readers
 * @param title - The new page title
 */
export function setPageTitle(title: string): void {
  document.title = title
}

/**
 * Focus an element and scroll it into view
 * @param element - The element to focus
 */
export function focusElement(element: HTMLElement | null): void {
  if (!element) return

  element.focus()
  element.scrollIntoView({
    block: 'nearest',
    behavior: 'smooth'
  })
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if high contrast is preferred
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches
}
