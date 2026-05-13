import { useValue } from '@legendapp/state/react'

/**
 * useTheme: dark mode hook with system preference detection and localStorage persistence.
 * DOM class + matchMedia are handled from `main` (`initSystemThemeMediaListener`) and `syncThemeToDom` on updates.
 */
import {
  resolveTheme as resolveStoredTheme,
  resolveTheme,
  type StoredTheme,
  syncThemeToDom,
  THEME_STORAGE_KEY,
} from '@/bootstrap/theme-dom'
import { safeSetItem } from '@/lib/safe-local-storage'
import { theme$ } from '@/store/theme-store'

export function useTheme() {
  const theme = useValue(() => resolveTheme(theme$.get()))

  const setTheme = (next: StoredTheme) => {
    safeSetItem(THEME_STORAGE_KEY, next)
    syncThemeToDom(resolveStoredTheme(next))
    theme$.set(next)
  }

  const toggleTheme = () => {
    theme$.set((prev) => {
      const next = resolveStoredTheme(prev) === 'dark' ? ('light' as const) : ('dark' as const)
      safeSetItem(THEME_STORAGE_KEY, next)
      syncThemeToDom(resolveStoredTheme(next))
      return next
    })
  }

  return { setTheme, theme, toggleTheme } as const
}
