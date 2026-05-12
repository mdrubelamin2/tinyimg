import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'

import './index.css'

import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { registerGlobalFileIntake } from '@/bootstrap/global-file-intake'
import { bootstrapSession } from '@/bootstrap/session-bootstrap'
import { startSessionMonitors } from '@/bootstrap/session-monitors'
import { applyThemeFromStorage, initSystemThemeMediaListener } from '@/bootstrap/theme-dom'

import App from './App.tsx'

void (async () => {
  try {
    await bootstrapSession()
  } catch (error) {
    console.warn('Session bootstrap failed:', error)
  }

  // Register the Service Worker for ZIP streaming and PWA features
  if ('serviceWorker' in navigator) {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        console.info('Service Worker registered!', registration)
      },
      onRegisterError(error) {
        console.error('Service Worker registration failed:', error)
      },
    })
  }

  applyThemeFromStorage()
  initSystemThemeMediaListener()

  const stopMonitors = startSessionMonitors()
  const stopFileIntake = registerGlobalFileIntake()

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopMonitors()
      stopFileIntake()
    })
  }

  const root = createRoot(document.querySelector('#root')!, {
    onCaughtError: (error, errorInfo) => {
      console.error('Caught error:', error, errorInfo)
    },
    onRecoverableError: (error, errorInfo) => {
      console.warn('Recoverable error:', error, errorInfo)
    },
    onUncaughtError: (error, errorInfo) => {
      console.error('Uncaught error:', error, errorInfo)
    },
  })

  root.render(<App />)
})()
