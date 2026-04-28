import { safeGetItem } from '@/lib/safe-local-storage'

export const THEME_STORAGE_KEY = 'tinyimg_theme'

const THEME_SWITCHING_CLASS = 'theme-switching'

export type StoredTheme = 'dark' | 'light' | 'system'

export function readStoredTheme(): StoredTheme {
  if (globalThis.window === undefined) return 'system'
  return (safeGetItem(THEME_STORAGE_KEY) as StoredTheme) ?? 'system'
}

export function resolveTheme(theme: StoredTheme): 'dark' | 'light' {
  return theme === 'system' ? getSystemTheme() : theme
}

export function syncThemeToDom(resolved: 'dark' | 'light'): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const isDark = resolved === 'dark'
  const hasDarkClass = root.classList.contains('dark')
  const needsToggle = (isDark && !hasDarkClass) || (!isDark && hasDarkClass)
  if (!needsToggle) return

  root.classList.add(THEME_SWITCHING_CLASS)
  root.classList.toggle('dark', isDark)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove(THEME_SWITCHING_CLASS)
    })
  })
}

function getSystemTheme(): 'dark' | 'light' {
  if (globalThis.window === undefined) return 'light'
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

let mediaListenerAttached = false

export function applyThemeFromStorage(): void {
  syncThemeToDom(resolveTheme(readStoredTheme()))
}

/** Call once from main before React root (pairs with useTheme localStorage updates). */
export function initSystemThemeMediaListener(): void {
  if (globalThis.window === undefined || mediaListenerAttached) return
  mediaListenerAttached = true
  const mq = globalThis.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onSystemPreferenceChange)
}

function onSystemPreferenceChange(): void {
  const theme = readStoredTheme()
  if (theme !== 'system') return
  syncThemeToDom(getSystemTheme())
}
