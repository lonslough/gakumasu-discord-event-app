import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from './HistoryPage'
import type { SubmissionHistory } from '../types'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), download: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc,
  storage: { from: () => ({ download: mocks.download }) } } }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'self' } } }) }))

const row = (overrides: Partial<SubmissionHistory> = {}): SubmissionHistory => ({
  id: 'submission', event_id: 'event', event_name: '第1回', is_active: false,
  character_options: [{ id: 'sena', name: '十王 星南', shortName: 'SENA', enabled: true }],
  discord_username: 'サーバー名', producer_name: 'P名', category: 'sena', entry_division: 'open',
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
  score_image_path: null, deck_image_path: null, beginner_proof_image_path: null,
  login_days_proof_image_path: null, verification_status: 'verified', confirmed_score: 12345,
  ...overrides,
})
const show = () => render(<MemoryRouter><HistoryPage /></MemoryRouter>)

describe('参加履歴', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.download.mockReset().mockResolvedValue({ data: new Blob(['image']), error: null })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:history'), revokeObjectURL: vi.fn() })
  })

  it('現在回と過去回の参加情報をAPI順に表示し編集操作を出さない', async () => {
    mocks.rpc.mockResolvedValue({ data: [row({ id: 'new', event_name: '第2回', is_active: true }), row()], error: null })
    show()
    expect(screen.getByRole('status')).toHaveTextContent('読み込み中')
    const table = await screen.findByRole('table', { name: '参加履歴' })
    const cards = within(table).getAllByRole('row').slice(1)
    expect(cards.map(card => within(card).getByRole('button').textContent)).toEqual(['第2回', '第1回'])
    expect(within(cards[0]).getByText('現在の開催回')).toBeInTheDocument()
    expect(within(cards[1]).getByText('12,345')).toBeInTheDocument()
    expect(within(cards[1]).getByText('十王 星南')).toBeInTheDocument()
    expect(within(cards[1]).getByText('サーバー名')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(mocks.rpc).toHaveBeenCalledWith('list_my_submission_history')
  })

  it.each([
    ['pending', 99999, '確認待ち'], ['invalid', 99999, '対象外'],
    ['verified', null, '得点未登録'], ['verified', 0, '0'],
  ] as const)('%s / %s の得点表示', async (verification_status, confirmed_score, label) => {
    mocks.rpc.mockResolvedValue({ data: [row({ verification_status, confirmed_score })], error: null })
    show()
    expect(await screen.findByText(label)).toBeInTheDocument()
    expect(screen.queryByText('99,999')).not.toBeInTheDocument()
  })

  it('未参加では回答入力へのリンクを表示', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    show()
    expect(await screen.findByText('参加履歴はまだありません')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '回答入力へ' })).toHaveAttribute('href', '/entry')
  })

  it.each(['response', 'exception'])('取得失敗 (%s) から再試行できる', async kind => {
    if (kind === 'response') mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('failure') })
    else mocks.rpc.mockRejectedValueOnce(new Error('offline'))
    mocks.rpc.mockResolvedValueOnce({ data: [row()], error: null })
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('参加履歴を読み込めませんでした')
    fireEvent.click(screen.getByRole('button', { name: '再試行' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('行をクリックすると旧形式画像と初心者証明を表示し、閉じるとURLを解放', async () => {
    mocks.rpc.mockResolvedValue({ data: [row({ entry_division: 'beginner', score_image_path: 'self/score/a',
      deck_image_path: 'self/deck/b', beginner_proof_image_path: 'self/beginner-proof/c',
      login_days_proof_image_path: 'self/login-days-proof/d' })], error: null })
    show()
    const record = await screen.findByRole('button', { name: '第1回の提出画像を表示' })
    expect(mocks.download).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(record.closest('tr')!)
    expect(await screen.findAllByRole('img')).toHaveLength(4)
    expect(screen.getByRole('button', { name: '評価値（旧形式）を閉じる' })).toBeInTheDocument()
    for (const label of ['デッキ（旧形式）', 'PID・Pレベル', '総出席日数']) {
      expect(screen.getByRole('button', { name: `${label}を閉じる` })).toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4)
    fireEvent.click(record)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
