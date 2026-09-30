import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
// Enable only after Web Analytics is activated in the Vercel project.
// Otherwise the SPA fallback can return HTML for the analytics script URL.
if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
  const analyticsWindow =
    window as Window & {
      va?: (...args: unknown[]) => void
      vaq?: unknown[][]
    }

  analyticsWindow.va =
    analyticsWindow.va ||
    ((...args: unknown[]) => {
      analyticsWindow.vaq =
        analyticsWindow.vaq || []
      analyticsWindow.vaq.push(args)
    })

  const analyticsScript =
    document.createElement('script')

  analyticsScript.defer = true
  analyticsScript.src =
    '/_vercel/insights/script.js'

  document.head.appendChild(
    analyticsScript,
  )
}

// Registrar Service Worker (PWA)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('SW registration failed:', error)
    })
  })
}
