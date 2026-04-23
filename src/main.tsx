import ReactDOM from 'react-dom/client';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import App from './App.tsx';
import './index.css';
import { ensureZipJsConfigured } from '@/lib/zip-js-config';
import { bootstrapSession } from '@/bootstrap/session-bootstrap';
import { startSessionMonitors } from '@/bootstrap/session-monitors';
import { registerGlobalFileIntake } from '@/bootstrap/global-file-intake';
import { applyThemeFromStorage, initSystemThemeMediaListener } from '@/bootstrap/theme-dom';

ensureZipJsConfigured();

void (async () => {
  try {
    await bootstrapSession();
  } catch (e) {
    console.warn('Session bootstrap failed:', e);
  }

  applyThemeFromStorage();
  initSystemThemeMediaListener();

  const stopMonitors = startSessionMonitors();
  const stopFileIntake = registerGlobalFileIntake();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      stopMonitors();
      stopFileIntake();
    });
  }

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
  });

  root.render(<App />);
})();
