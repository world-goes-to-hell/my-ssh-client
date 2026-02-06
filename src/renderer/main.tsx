import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

// Suppress ResizeObserver loop warning (harmless)
const resizeObserverErr = window.onerror
window.onerror = (message, ...args) => {
  if (typeof message === 'string' && message.includes('ResizeObserver loop')) {
    return true
  }
  return resizeObserverErr ? resizeObserverErr(message, ...args) : false
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
