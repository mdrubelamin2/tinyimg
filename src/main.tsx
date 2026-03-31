import ReactDOM from 'react-dom/client'
import { Provider as JotaiProvider, createStore } from 'jotai'
import App from './App.tsx'
import './index.css'

// Create Jotai store
export const jotaiStore = createStore()

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

root.render(
  <JotaiProvider store={jotaiStore}>
    <App />
  </JotaiProvider>
)
