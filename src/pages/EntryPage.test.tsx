import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EntryPage } from './EntryPage'
import { EntryRankPoints } from '../components/entry/EntryRankPoints'
import type { EventSettings, Submission } from '../types'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), maybeSingle: vi.fn(), saveEntry: vi.fn(),
  session: { user: { id: 'self' } },
}))
vi.mock('../lib/supabase', () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }) }),
} }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ session: mocks.session }) }))
vi.mock('../lib/siteConfig', () => ({ useSiteConfig: () => ({ entryImage: 'entry.png' }), siteAssetUrl: (path: string) => path }))
vi.mock('../lib/entryService', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/entryService')>(), saveEntry: mocks.saveEntry,
}))

const settings: EventSettings = {
  event_id: 'current', event_name: '第6回', server_now: '2026-10-20T00:00:00Z',
  submission_start_at: null, submission_end_at: null, accepting_submissions: true, rules_description: '',
  character_options: [
    { id: 'sena', name: '十王 星南', shortName: 'SENA', enabled: true },
    { id: 'tsubame', name: '雨夜 燕', shortName: 'TSUBAME', enabled: true },
  ],
}
const submission: Submission = {
  id: 'mine', event_id: 'current', user_id: 'self', discord_username: 'サーバー名', producer_name: 'P名',
  category: 'sena', entry_division: 'open', score_image_path: null, deck_image_path: null,
  beginner_proof_image_path: null, login_days_proof_image_path: null,
  created_at: '2026-10-01', updated_at: '2026-10-02',
}
const show = () => render(<MemoryRouter><EntryPage /></MemoryRouter>)

describe('回答入力の1つ上の順位のポイント', () => {
  beforeEach(() => {
    mocks.maybeSingle.mockReset().mockResolvedValue({ data: submission, error: null })
    mocks.saveEntry.mockReset().mockResolvedValue(undefined)
    mocks.rpc.mockReset().mockImplementation(name => Promise.resolve({
      data: name === 'get_event_settings' ? settings : { status: 'ranked', higher_score: 28000 }, error: null,
    }))
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks() })

  const soleSettings = (requiresProof = false): EventSettings => ({ ...settings,
    division_settings: { custom: { name: '唯一の部門', description: '', eligibility: '参加条件の案内', requiresProof, order: 0 } },
  })
  function newAnswer(config: EventSettings) {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.rpc.mockImplementation(name => Promise.resolve({ data: name === 'get_event_settings' ? config : { status: 'unranked', higher_score: null }, error: null }))
  }
  async function fillParticipant() {
    fireEvent.click(await screen.findByRole('button', { name: '確認しました' }))
    fireEvent.change(screen.getByRole('textbox', { name: /サーバー内ユーザーネーム/ }), { target: { value: '新しい参加者' } })
    fireEvent.change(screen.getByRole('textbox', { name: /ゲーム内プロデューサーネーム/ }), { target: { value: '新しいP' } })
    fireEvent.click(screen.getByRole('radio', { name: /十王 星南/ }))
  }
  it('新規の単一部門は自動チェックしクリックせずそのIDで送信できる', async () => {
    newAnswer(soleSettings()); show()
    const radio = await screen.findByRole('radio', { name: '唯一の部門' })
    await waitFor(() => expect(radio).toBeChecked())
    expect(radio).toBeEnabled()
    expect(mocks.saveEntry).not.toHaveBeenCalled()
    await fillParticipant()
    fireEvent.click(screen.getByRole('button', { name: '回答を送信する' }))
    fireEvent.click(await screen.findByRole('button', { name: '確認' }))
    await waitFor(() => expect(mocks.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ entryDivision: 'custom', discordUsername: '新しい参加者' }) })))
  })
  it('複数部門の新規回答は自動チェックしない', async () => {
    newAnswer({ ...soleSettings(), division_settings: { ...soleSettings().division_settings, other: { name: '別の部門', description: '', requiresProof: false, order: 1 } } }); show()
    const radios = await screen.findAllByRole('radio', { name: /唯一の部門|別の部門/ })
    expect(radios).toHaveLength(2)
    radios.forEach(radio => expect(radio).not.toBeChecked())
  })
  it('本人回答の読込完了まで待ち、保存済みの回答と選択を保持する', async () => {
    let finish!: (result: unknown) => void
    mocks.maybeSingle.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    mocks.rpc.mockImplementation(name => Promise.resolve({ data: name === 'get_event_settings' ? soleSettings() : { status: 'unranked', higher_score: null }, error: null }))
    show()
    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalled())
    expect(screen.queryByRole('radio', { name: '唯一の部門' })).not.toBeInTheDocument()
    await act(async () => finish({ data: { ...submission, entry_division: 'custom', producer_name: '保存済みP' }, error: null }))
    const radio = await screen.findByRole('radio', { name: '唯一の部門' })
    expect(radio).toBeChecked(); expect(radio).toBeDisabled()
    expect(screen.getByRole('textbox', { name: /ゲーム内プロデューサーネーム/ })).toHaveValue('保存済みP')
  })
  it('自動チェックした証明必須部門でも証明2点不足を拒否する', async () => {
    newAnswer(soleSettings(true)); show()
    await waitFor(() => expect(screen.getByRole('radio', { name: '唯一の部門' })).toBeChecked())
    expect(screen.getByText('参加条件の案内')).toBeInTheDocument()
    await fillParticipant()
    fireEvent.click(screen.getByRole('button', { name: '回答を送信する' }))
    expect(await screen.findByText('PIDとPレベルがわかる画像を選択してください。')).toBeInTheDocument()
    expect(screen.getByText('総出席日数がわかる画像を選択してください。')).toBeInTheDocument()
    expect(mocks.saveEntry).not.toHaveBeenCalled()
  })
  it('設定再取得で単一部門になっても編集中の参加者名を保持する', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    let settingsCalls = 0
    mocks.rpc.mockImplementation(name => {
      if (name !== 'get_event_settings') return Promise.resolve({ data: { status: 'unranked', higher_score: null }, error: null })
      const config = soleSettings()
      if (++settingsCalls === 1) {
        config.submission_end_at = config.server_now
        config.division_settings!.other = { name: '別の部門', description: '', requiresProof: false, order: 1 }
      }
      return Promise.resolve({ data: config, error: null })
    })
    show(); await fillParticipant()
    await waitFor(() => expect(screen.getByRole('radio', { name: '唯一の部門' })).toBeChecked(), { timeout: 2500 })
    expect(screen.getByRole('textbox', { name: /サーバー内ユーザーネーム/ })).toHaveValue('新しい参加者')
    expect(screen.getByRole('textbox', { name: /ゲーム内プロデューサーネーム/ })).toHaveValue('新しいP')
    expect(mocks.saveEntry).not.toHaveBeenCalled()
  })

  it('通知の下にポイントだけを表示し未保存のキャラ変更では再取得しない', async () => {
    show()
    const score = await screen.findByText('28,000')
    const card = score.closest('section')!
    expect(card.previousElementSibling).toHaveClass('notice')
    expect(card.nextElementSibling?.tagName).toBe('FORM')
    expect(card).toHaveTextContent('1つ上の順位のポイント')
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_rank_neighbor', { p_event_id: 'current' })
    fireEvent.click(screen.getByRole('radio', { name: /雨夜 燕/ }))
    expect(screen.getByText('28,000')).toBeInTheDocument()
    expect(mocks.rpc.mock.calls.filter(([name]) => name === 'get_my_rank_neighbor')).toHaveLength(1)
  })

  it.each([
    ['first', null, '現在1位です'], ['ranked', 0, '0'],
  ])('%s / %sを表示', async (status, higher_score, label) => {
    mocks.rpc.mockImplementation(name => Promise.resolve({ data: name === 'get_event_settings' ? settings : { status, higher_score }, error: null }))
    show()
    expect(await screen.findByText(label!)).toBeInTheDocument()
  })

  it.each(['unranked', 'closed'])('%sでは見出しも含めて非表示', async status => {
    mocks.rpc.mockImplementation(name => Promise.resolve({ data: name === 'get_event_settings' ? settings : { status, higher_score: null }, error: null }))
    show()
    await screen.findByRole('button', { name: '回答を上書きする' })
    await waitFor(() => expect(screen.queryByText('1つ上の順位のポイント')).not.toBeInTheDocument())
  })

  it.each(['response', 'exception'])('取得失敗（%s）で入力を維持し再試行ボタンを追加しない', async kind => {
    let rejectRank: (error: Error) => void = () => {}
    let finishRank: (value: unknown) => void = () => {}
    const pending = new Promise((resolve, reject) => { finishRank = resolve; rejectRank = reject })
    mocks.rpc.mockImplementation(name => name === 'get_event_settings' ? Promise.resolve({ data: settings, error: null }) : pending)
    show()
    const input = await screen.findByRole('textbox', { name: /サーバー内ユーザーネーム/ })
    fireEvent.change(input, { target: { value: '編集中の名前' } })
    await act(async () => {
      if (kind === 'exception') rejectRank(new Error('offline'))
      else finishRank({ data: null, error: new Error('offline') })
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('ポイントを取得できませんでした')
    expect(input).toHaveValue('編集中の名前')
    expect(input).toBeEnabled()
    expect(screen.queryByRole('button', { name: '再試行' })).not.toBeInTheDocument()
  })

  it('保存成功後に再取得し、確認待ちになった場合は欄を消す', async () => {
    let rankCalls = 0
    mocks.rpc.mockImplementation(name => {
      if (name === 'get_event_settings') return Promise.resolve({ data: settings, error: null })
      const data = ++rankCalls === 1 ? { status: 'ranked', higher_score: 28000 } : { status: 'unranked', higher_score: null }
      return Promise.resolve({ data, error: null })
    })
    show()
    await screen.findByText('28,000')
    fireEvent.click(screen.getByRole('radio', { name: /雨夜 燕/ }))
    fireEvent.click(screen.getByRole('button', { name: '回答を上書きする' }))
    fireEvent.click(await screen.findByRole('button', { name: '確認' }))
    await screen.findByText('回答を保存しました。')
    await waitFor(() => expect(screen.queryByText('1つ上の順位のポイント')).not.toBeInTheDocument())
    expect(mocks.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ userId: 'self', eventId: 'current', values: expect.objectContaining({ category: 'tsubame' }) }))
    expect(rankCalls).toBe(2)
  })

  it('期間外はAPIを呼ばずポイント欄を表示しない', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...settings, accepting_submissions: false }, error: null })
    show()
    expect(await screen.findByRole('button', { name: '回答を上書きする' })).toBeDisabled()
    expect(screen.queryByText('1つ上の順位のポイント')).not.toBeInTheDocument()
    expect(mocks.rpc).not.toHaveBeenCalledWith('get_my_rank_neighbor', expect.anything())
  })

  it('受付終了の設定再取得で欄を消す', async () => {
    let settingsCalls = 0
    mocks.rpc.mockImplementation(name => Promise.resolve({ data: name === 'get_event_settings' ?
      { ...settings, submission_end_at: settings.server_now, accepting_submissions: ++settingsCalls === 1 } :
      { status: 'ranked', higher_score: 28000 }, error: null }))
    show()
    await screen.findByText('28,000')
    await waitFor(() => expect(screen.queryByText('1つ上の順位のポイント')).not.toBeInTheDocument(), { timeout: 2500 })
    expect(screen.getByRole('button', { name: '回答を上書きする' })).toBeDisabled()
  })

  it('本人・開催回変更後に旧リクエストが解決しても表示を上書きしない', async () => {
    let finishOld: (value: unknown) => void = () => {}
    mocks.rpc.mockImplementation((_name, args) => args.p_event_id === 'old' ?
      new Promise(resolve => { finishOld = resolve }) : Promise.resolve({ data: { status: 'ranked', higher_score: 9000 }, error: null }))
    const view = render(<EntryRankPoints key="self:old" eventId="old" />)
    view.rerender(<EntryRankPoints key="other:new" eventId="new" />)
    await screen.findByText('9,000')
    await act(async () => { finishOld({ data: { status: 'ranked', higher_score: 28000 }, error: null }) })
    expect(screen.getByText('9,000')).toBeInTheDocument()
    expect(screen.queryByText('28,000')).not.toBeInTheDocument()
  })
})
