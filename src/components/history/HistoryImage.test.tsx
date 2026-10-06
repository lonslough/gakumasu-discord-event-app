import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryImage } from './HistoryImage'

const mocks = vi.hoisted(() => ({ download: vi.fn(), bucket: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { storage: { from: mocks.bucket } } }))

describe('参加履歴の提出画像', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  beforeEach(() => {
    mocks.download.mockReset()
    mocks.bucket.mockReturnValue({ download: mocks.download })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:history'), revokeObjectURL: vi.fn() })
  })
  it('未提出では取得しない', () => {
    render(<HistoryImage path={null} label="結果" />)
    expect(screen.getByText('未提出')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(mocks.download).not.toHaveBeenCalled()
  })
  it('操作後に取得し、閉じた時にURLを解放、再度開くと再取得', async () => {
    mocks.download.mockResolvedValue({ data: new Blob(['image']), error: null })
    render(<HistoryImage path="self/score/image" label="結果" />)
    expect(mocks.download).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '結果を表示' }))
    expect(await screen.findByRole('img')).toHaveAttribute('src', 'blob:history')
    expect(mocks.bucket).toHaveBeenCalledWith('submission-images')
    expect(mocks.download).toHaveBeenCalledWith('self/score/image')
    fireEvent.click(screen.getByRole('button', { name: '結果を閉じる' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:history')
    fireEvent.click(screen.getByRole('button', { name: '結果を表示' }))
    await screen.findByRole('img')
    expect(mocks.download).toHaveBeenCalledTimes(2)
  })
  it('取得失敗後に再試行でき、表示失敗も通知する', async () => {
    mocks.download.mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ data: new Blob(['image']), error: null })
    render(<HistoryImage path="self/score/image" label="結果" />)
    fireEvent.click(screen.getByRole('button', { name: '結果を表示' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした')
    fireEvent.click(screen.getByRole('button', { name: '結果を再試行' }))
    fireEvent.error(await screen.findByRole('img'))
    expect(screen.getByRole('alert')).toHaveTextContent('表示できませんでした')
  })
  it('読込中に閉じた場合は遅れて届く結果を破棄', async () => {
    let resolve!: (value: { data: Blob; error: null }) => void
    mocks.download.mockReturnValue(new Promise(done => { resolve = done }))
    render(<HistoryImage path="self/score/image" label="結果" />)
    fireEvent.click(screen.getByRole('button', { name: '結果を表示' }))
    expect(screen.getByRole('status')).toHaveTextContent('読み込み中')
    fireEvent.click(screen.getByRole('button', { name: '結果を閉じる' }))
    await act(async () => resolve({ data: new Blob(['image']), error: null }))
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument())
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
