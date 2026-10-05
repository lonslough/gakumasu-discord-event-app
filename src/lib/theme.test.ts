import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  saveTheme,
  THEME_STORAGE_KEY,
} from './theme'

describe('画面テーマ', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
  })

  it('保存値がない場合は端末の配色設定を取得する', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true }),
    )

    expect(getStoredTheme()).toBeNull()
    expect(getSystemTheme()).toBe('dark')
  })

  it('手動選択を保存して文書へ反映する', () => {
    saveTheme('light')

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')

    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('無効な保存値は端末設定の上書きとして扱わない', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia')

    expect(getStoredTheme()).toBeNull()
  })
})

