export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'gakumasu-theme'

export function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

let selectedTheme: Theme | null = null
export function getStoredTheme(): Theme | null { return selectedTheme }

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function saveTheme(theme: Theme) { selectedTheme = theme; applyTheme(theme) }
