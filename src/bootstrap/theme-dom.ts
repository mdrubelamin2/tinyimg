export const THEME_STORAGE_KEY = 'tinyimg_theme';
const STORAGE_KEY = THEME_STORAGE_KEY;

const THEME_SWITCHING_CLASS = 'theme-switching';

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
  const needsToggle = (isDark && !hasDarkClass) || (!isDark && hasDarkClass);
  if (!needsToggle) return;

  root.classList.add(THEME_SWITCHING_CLASS);
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove(THEME_SWITCHING_CLASS);
    });
  });
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
