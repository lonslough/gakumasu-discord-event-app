import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PageImageGuide } from './PageImageGuide'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

describe('画像調整画面のサンプルガイド', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(440)
    document.documentElement.dataset.theme = 'dark'
    document.body.style.overflow = 'visible'
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('ログインフォームを表示し、PCスマホ切替と画像変更を保存処理なしで反映する', async () => {
    const view = render(<PageImageGuide target="login" source="data:image/jpeg;base64,first" />)
    const frame = await screen.findByTitle('ログイン画面のPCプレビュー') as HTMLIFrameElement
    await waitFor(() => expect(frame.contentDocument!.querySelector('.login-card')).not.toBeNull())
    const inside = within(frame.contentDocument!.body)
    expect(inside.getByLabelText('ユーザーID')).toBeDisabled()
    expect(inside.getByRole('button', { name: 'ログイン' })).toBeDisabled()
    expect(frame.getAttribute('sandbox')).toBe('allow-same-origin')
    expect(frame.width).toBe('1366')
    expect(document.body.style.overflow).toBe('visible')
    fireEvent.click(screen.getByRole('button', { name: 'スマホ' }))
    expect(frame.width).toBe('390')
    expect(frame.height).toBe('844')
    view.rerender(<PageImageGuide target="login" source="data:image/jpeg;base64,changed" />)
    await waitFor(() => expect(inside.getByAltText('調整中のログイン画像')).toHaveAttribute('src', 'data:image/jpeg;base64,changed'))
    expect(screen.getByRole('button', { name: 'スマホ' })).toHaveAttribute('aria-pressed', 'true')
    document.documentElement.dataset.theme = 'light'
    await waitFor(() => expect(frame.contentDocument!.documentElement.dataset.theme).toBe('light'))
    view.unmount()
    expect(document.querySelector('iframe')).toBeNull()
    expect(document.body.style.overflow).toBe('visible')
  })

  it('回答画面に固定サンプルと入力欄を表示し、送信や認証機能を含めない', async () => {
    render(<PageImageGuide target="entry" source="data:image/jpeg;base64,banner" />)
    const frame = await screen.findByTitle('回答入力画面のPCプレビュー') as HTMLIFrameElement
    await waitFor(() => expect(frame.contentDocument!.querySelector('h1')).toHaveTextContent('サンプル開催回'))
    const inside = within(frame.contentDocument!.body)
    expect(inside.getByLabelText(/サーバー内ユーザーネーム/)).toBeDisabled()
    expect(inside.getByRole('button', { name: '回答を送信する' })).toBeDisabled()
    expect(inside.getByText('十王 星南')).toBeInTheDocument()
    expect(inside.getByText('雨夜 燕')).toBeInTheDocument()
    expect(frame.contentDocument!.querySelector('form')).toBeNull()
    expect(inside.getByAltText('調整中の回答入力バナー')).toHaveAttribute('src', 'data:image/jpeg;base64,banner')
    fireEvent.click(screen.getByRole('button', { name: 'スマホ' }))
    expect(frame.width).toBe('390')
    expect(frame.contentDocument!.querySelector('h1')).toHaveTextContent('サンプル開催回')
  })
})
