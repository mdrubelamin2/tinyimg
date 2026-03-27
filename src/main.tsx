import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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
