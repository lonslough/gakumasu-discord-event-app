import { useEffect, useState } from 'react'
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  saveTheme,
  type Theme,
} from '../lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const current = document.documentElement.dataset.theme
    return current === 'light' || current === 'dark'
      ? current
      : (getStoredTheme() ?? getSystemTheme())
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const followSystemTheme = (event: MediaQueryListEvent) => {
      if (getStoredTheme() === null) {
        setTheme(event.matches ? 'dark' : 'light')
      }
    }
    media.addEventListener('change', followSystemTheme)
    return () => media.removeEventListener('change', followSystemTheme)
  }, [])

  const nextTheme: Theme = theme === 'light' ? 'dark' : 'light'

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`${nextTheme === 'light' ? 'ライト' : 'ダーク'}テーマに切り替える`}
      title={`${nextTheme === 'light' ? 'ライト' : 'ダーク'}テーマに切り替える`}
      onClick={() => {
        saveTheme(nextTheme)
        setTheme(nextTheme)
      }}
    >
      <span aria-hidden="true">{theme === 'light' ? '☀' : '☾'}</span>
      <span className="theme-toggle-label">
        {theme === 'light' ? 'ライト' : 'ダーク'}
      </span>
    </button>
  )
}

