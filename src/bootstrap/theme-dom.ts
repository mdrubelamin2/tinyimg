export const THEME_STORAGE_KEY = 'tinyimg_theme';
const STORAGE_KEY = THEME_STORAGE_KEY;

export type StoredTheme = 'light' | 'dark' | 'system';

export function readStoredTheme(): StoredTheme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(STORAGE_KEY) as StoredTheme) ?? 'system';
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(theme: StoredTheme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function syncThemeToDom(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const isDark = resolved === 'dark';
  const hasDarkClass = root.classList.contains('dark');
  if (isDark && !hasDarkClass) {
    root.classList.add('dark');
  } else if (!isDark && hasDarkClass) {
    root.classList.remove('dark');
  }
}

let mediaListenerAttached = false;

function onSystemPreferenceChange(): void {
  const theme = readStoredTheme();
  if (theme !== 'system') return;
  syncThemeToDom(getSystemTheme());
}

/** Call once from main before React root (pairs with useTheme localStorage updates). */
export function initSystemThemeMediaListener(): void {
  if (typeof window === 'undefined' || mediaListenerAttached) return;
  mediaListenerAttached = true;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', onSystemPreferenceChange);
}

export function applyThemeFromStorage(): void {
  syncThemeToDom(resolveTheme(readStoredTheme()));
}
