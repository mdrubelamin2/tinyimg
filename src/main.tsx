import ReactDOM from 'react-dom/client'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/space-grotesk/400.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import App from './App.tsx'
import './index.css'
import { ensureZipJsConfigured } from '@/lib/zip-js-config'

if (import.meta.env.DEV) {
  void import('react-scan').then(({ scan }) => {
    scan({ enabled: true })
  })
}

ensureZipJsConfigured()

const root = ReactDOM.createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error('Caught error:', error, errorInfo);
  },
  onUncaughtError: (error, errorInfo) => {
    console.error('Uncaught error:', error, errorInfo);
  },
  onRecoverableError: (error, errorInfo) => {
    console.warn('Recoverable error:', error, errorInfo);
  },
})

root.render(<App />)
