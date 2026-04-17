/**
 * useTheme: dark mode hook with system preference detection and localStorage persistence.
 * DOM class + matchMedia are handled from `main` (`initSystemThemeMediaListener`) and `syncThemeToDom` on updates.
 */

import { useState, useTransition } from 'react';
import {
  THEME_STORAGE_KEY,
  readStoredTheme,
  resolveTheme as resolveStoredTheme,
  syncThemeToDom,
  type StoredTheme,
} from '@/bootstrap/theme-dom';

type Theme = StoredTheme;

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return resolveStoredTheme(theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  const [isPending, startTransition] = useTransition();
  const resolved = resolveTheme(theme);

  const setTheme = (next: Theme) => {
    startTransition(() => {
      localStorage.setItem(THEME_STORAGE_KEY, next);
      syncThemeToDom(resolveTheme(next));
      setThemeState(next);
    });
  };

  const toggleTheme = () => {
    startTransition(() => {
      setThemeState((prev) => {
        const next = resolveTheme(prev) === 'dark' ? ('light' as const) : ('dark' as const);
        localStorage.setItem(THEME_STORAGE_KEY, next);
        syncThemeToDom(resolveTheme(next));
        return next;
      });
    });
  };

  return { theme, resolved, setTheme, toggleTheme, isPending } as const;
}
