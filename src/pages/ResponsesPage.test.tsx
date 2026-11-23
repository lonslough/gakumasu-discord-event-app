import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResponsesPage } from './ResponsesPage'
import type { PublicRankingEntry, PublicRankingEvent } from '../types'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  auth: { loading: false, profile: { role: 'user' } as { role: 'user' | 'admin' } | null, session: { user: { id: 'self' } } },
}))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }))
vi.mock('../hooks/useReviewImages', () => ({ useReviewImages: () => ({ images: {}, loading: false, load: vi.fn(), clear: vi.fn() }) }))

const characters = [
  { id: 'sena', name: '十王 星南', shortName: '星南', enabled: true },
  { id: 'tsubame', name: '雨夜 燕', shortName: '燕', enabled: true },
]
const events: PublicRankingEvent[] = [
  { id: 'newest', name: '最新の公開回', is_active: false, character_options: characters, created_at: '2026-11-01' },
  { id: 'active', name: '受付対象の公開回', is_active: true, character_options: characters, created_at: '2026-10-01' },
]
const row = (name: string, rank = 1, score = 28000): PublicRankingEntry => ({
  category: 'sena', entry_division: 'open', rank, discord_username: name, producer_name: name + 'P', confirmed_score: score,
})
type Result = { data: unknown; error: Error | null }
function deferred() {
  let resolve!: (value: Result) => void
  const promise = new Promise<Result>(done => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  mocks.auth.loading = false
  mocks.auth.profile = { role: 'user' }
  mocks.rpc.mockReset()
  mocks.from.mockReset()
  mocks.from.mockImplementation(() => { throw new Error('General user must not query admin tables') })
  mocks.rpc.mockImplementation(async name => {
    if (name === 'list_public_ranking_events') return { data: events, error: null }
    if (name === 'get_public_rankings') return { data: [row('公開ユーザー')], error: null }
    throw new Error('Unexpected admin RPC: ' + name)
  })
})
afterEach(cleanup)

describe('一般向けランキング', () => {
  it('一般ユーザーには公開回とランキングだけを表示し管理APIを呼ばない', async () => {
    render(<ResponsesPage />)
    expect(await screen.findByText('公開ユーザー')).toBeInTheDocument()
    expect(screen.getByLabelText('表示する開催回')).toHaveValue('active')
    expect(screen.getAllByRole('option')).toHaveLength(2)
    expect(screen.queryByText('登録ユーザー数')).not.toBeInTheDocument()
    expect(screen.queryByText('回答一覧')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'CSV出力' })).not.toBeInTheDocument()
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc.mock.calls.every(([name]) => ['list_public_ranking_events', 'get_public_rankings'].includes(name))).toBe(true)
  })

  it('公開された受付対象がなければ最新の公開回を初期選択する', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: events.map(event => ({ ...event, is_active: false })), error: null })
    render(<ResponsesPage />)
    await screen.findByText('公開ユーザー')
    expect(screen.getByLabelText('表示する開催回')).toHaveValue('newest')
  })

  it('公開回がないと準備中文言を表示しランキングを取得しない', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    render(<ResponsesPage />)
    expect(await screen.findByText('ランキングは公開準備中です。')).toBeInTheDocument()
    expect(screen.queryByLabelText('表示する開催回')).not.toBeInTheDocument()
    expect(mocks.rpc).not.toHaveBeenCalledWith('get_public_rankings', expect.anything())
  })

  it('開催回の読込中に空状態を表示しない', () => {
    mocks.rpc.mockReturnValue(new Promise(() => {}))
    render(<ResponsesPage />)
    expect(screen.getByLabelText('開催回を読み込み中')).toBeInTheDocument()
    expect(screen.queryByText('ランキングは公開準備中です。')).not.toBeInTheDocument()
  })

  it.each(['returned', 'thrown'])('開催回取得の%sエラーを空状態と区別する', async mode => {
    if (mode === 'returned') mocks.rpc.mockResolvedValue({ data: null, error: new Error('failed') })
    else mocks.rpc.mockRejectedValue(new Error('network'))
    render(<ResponsesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('開催回を読み込めませんでした。')
    expect(screen.queryByText('ランキングは公開準備中です。')).not.toBeInTheDocument()
  })

  it.each(['returned', 'thrown'])('ランキング取得の%sエラーを表示する', async mode => {
    mocks.rpc.mockImplementation(async name => {
      if (name === 'list_public_ranking_events') return { data: events, error: null }
      if (mode === 'thrown') throw new Error('network')
      return { data: null, error: new Error('private now') }
    })
    render(<ResponsesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('ランキングを読み込めませんでした。')
    expect(screen.queryByText('十王 星南ランキング')).not.toBeInTheDocument()
  })

  it('回答のない公開回は3部門の空表示になる', async () => {
    mocks.rpc.mockImplementation(async name => ({ data: name === 'list_public_ranking_events' ? events : [], error: null }))
    render(<ResponsesPage />)
    expect(await screen.findAllByText('ランキング対象の回答はありません。')).toHaveLength(3)
  })

  it('RPCの順位に従って並べ0点も表示する', async () => {
    mocks.rpc.mockImplementation(async name => ({ data: name === 'list_public_ranking_events' ? events : [row('二位', 2, 0), row('一位')], error: null }))
    render(<ResponsesPage />)
    await screen.findByText('二位')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('一位')
    expect(screen.getAllByRole('listitem')[1]).toHaveTextContent('0')
  })

  it('回の切替中は前回の結果を隠し、切替後に表示する', async () => {
    const pending = deferred()
    mocks.rpc.mockImplementation((name, args) => {
      if (name === 'list_public_ranking_events') return Promise.resolve({ data: events, error: null })
      if (args.p_event_id === 'newest') return pending.promise
      return Promise.resolve({ data: [row('旧回の名前')], error: null })
    })
    render(<ResponsesPage />)
    await screen.findByText('旧回の名前')
    fireEvent.change(screen.getByLabelText('表示する開催回'), { target: { value: 'newest' } })
    expect(screen.queryByText('旧回の名前')).not.toBeInTheDocument()
    expect(screen.getByLabelText('ランキングを読み込み中')).toBeInTheDocument()
    await act(async () => { pending.resolve({ data: [row('新回の名前')], error: null }) })
    expect(await screen.findByText('新回の名前')).toBeInTheDocument()
  })

  it('切替前の回の遅延応答で現在回を上書きしない', async () => {
    const pending = deferred()
    mocks.rpc.mockImplementation((name, args) => {
      if (name === 'list_public_ranking_events') return Promise.resolve({ data: events, error: null })
      if (args.p_event_id === 'active') return pending.promise
      return Promise.resolve({ data: [row('現在回')], error: null })
    })
    render(<ResponsesPage />)
    await screen.findByLabelText('ランキングを読み込み中')
    fireEvent.change(screen.getByLabelText('表示する開催回'), { target: { value: 'newest' } })
    await screen.findByText('現在回')
    await act(async () => { pending.resolve({ data: [row('古い応答')], error: null }) })
    expect(screen.queryByText('古い応答')).not.toBeInTheDocument()
    expect(screen.getByText('現在回')).toBeInTheDocument()
  })

  it('プロフィール未取得ではデータを取得しない', () => {
    mocks.auth.profile = null
    render(<ResponsesPage />)
    expect(screen.getByLabelText('読み込み中')).toBeInTheDocument()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('管理者の既存機能を維持し一般ロールに切り替わると管理表示を破棄する', async () => {
    mocks.auth.profile = { role: 'admin' }
    mocks.from.mockReturnValue({ select: () => ({ order: async () => ({ data: events, error: null }) }) })
    mocks.rpc.mockImplementation(async name => {
      if (name === 'count_registered_users') return { data: 6, error: null }
      if (name === 'list_public_ranking_events') return { data: events, error: null }
      return { data: [], error: null }
    })
    const view = render(<ResponsesPage />)
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('list_admin_submissions', { p_event_id: 'active' }))
    expect(screen.getByRole('button', { name: 'CSV出力' })).toBeInTheDocument()
    expect(screen.getByText('回答一覧')).toBeInTheDocument()
    expect(screen.getByText('登録ユーザー数')).toBeInTheDocument()
    mocks.auth.profile = { role: 'user' }
    mocks.rpc.mockClear()
    view.rerender(<ResponsesPage />)
    await screen.findByLabelText('表示する開催回')
    expect(screen.queryByRole('button', { name: 'CSV出力' })).not.toBeInTheDocument()
    expect(screen.queryByText('回答一覧')).not.toBeInTheDocument()
    expect(mocks.rpc.mock.calls.every(([name]) => ['list_public_ranking_events', 'get_public_rankings'].includes(name))).toBe(true)
  })
})
