/**
 * useTheme: dark mode hook with system preference detection and localStorage persistence.
 */

import { useState, useEffect, useTransition } from 'react';

const STORAGE_KEY = 'tinyimg_theme';
type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem(STORAGE_KEY) as Theme) ?? 'system';
  });

  const [isPending, startTransition] = useTransition();
  const resolved = resolveTheme(theme);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = resolved === 'dark';
    const hasDarkClass = root.classList.contains('dark');
    
    if (isDark && !hasDarkClass) {
      root.classList.add('dark');
    } else if (!isDark && hasDarkClass) {
      root.classList.remove('dark');
    }
  }, [resolved]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = document.documentElement;
      const isDark = mq.matches;
      const hasDarkClass = root.classList.contains('dark');
      
      if (isDark && !hasDarkClass) {
        root.classList.add('dark');
      } else if (!isDark && hasDarkClass) {
        root.classList.remove('dark');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (next: Theme) => {
    startTransition(() => {
      setThemeState(next);
      localStorage.setItem(STORAGE_KEY, next);
    });
  };

  const toggleTheme = () => {
    startTransition(() => {
      setThemeState(prev => {
        const next = resolveTheme(prev) === 'dark' ? 'light' as const : 'dark' as const;
        localStorage.setItem(STORAGE_KEY, next);
        return next;
      });
    });
  };

  return { theme, resolved, setTheme, toggleTheme, isPending } as const;
}
