import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'

import './index.css'

import ReactDOM from 'react-dom/client'
import { getSerwist } from 'virtual:serwist'

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
    const serwist = await getSerwist()

    serwist?.addEventListener('installed', () => {
      console.info('Serwist installed!')
    })

    void serwist
      ?.register({ immediate: true })
      .then(() => {
        console.info('Serwist registration successful!')
      })
      .catch((error) => {
        console.error('Serwist registration failed:', error)
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

  const root = ReactDOM.createRoot(document.querySelector('#root')!, {
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
