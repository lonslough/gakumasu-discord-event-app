import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import { copyDivisions } from '../lib/divisions'
import type { EventEdition } from '../types'

const mocks = vi.hoisted(() => ({ events: [] as EventEdition[], rpc: vi.fn(), fail: false, update: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'admin' } } }) }))
vi.mock('../components/settings/PageImageSettings', () => ({ PageImageSettings: () => null, uploadPageImages: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: {
  rpc: (...args: unknown[]) => mocks.rpc(...args),
  from: () => ({
    select: () => ({ order: async () => ({ data: structuredClone(mocks.events), error: null }) }),
    update: (values: Partial<EventEdition>) => ({ eq: async (_: string, id: string) => {
      mocks.update(values)
      if (mocks.fail) return { error: new Error('failed') }
      Object.assign(mocks.events.find(e => e.id === id)!, values)
      return { error: null }
    } }),
  }),
} }))
const edition = (id: string, isActive = false): EventEdition => ({
  id, name: id, is_active: isActive, ranking_published: false, rules_description: '',
  submission_start_at: null, submission_end_at: null, page_images_path: null,
  character_options: [{ id: 'sena', name: '星南', shortName: '星南', enabled: true }, { id: 'tsubame', name: '燕', shortName: '燕', enabled: true }],
  created_at: id === 'newest' ? '2026-11-01' : '2026-10-01', updated_at: '', division_settings: copyDivisions(),
})
afterEach(cleanup)
beforeEach(() => {
  mocks.events = [edition('newest'), edition('active', true)]
  mocks.fail = false; mocks.update.mockReset()
  mocks.rpc.mockReset().mockResolvedValue({ data: {}, error: null })
})
describe('開催回別の部門設定保存', () => {
  it('追加部門を他設定と一緒に保存し、trim・表示順・証明要件を保持する', async () => {
    render(<SettingsPage />)
    await screen.findByDisplayValue('無差別部門')
    fireEvent.click(screen.getByRole('button', { name: '部門を追加' }))
    fireEvent.change(screen.getByLabelText('部門4の名称'), { target: { value: ' 新設枠 ' } })
    fireEvent.change(screen.getByLabelText('部門4の参加条件文'), { target: { value: ' 新設条件 ' } })
    await waitFor(() => expect(screen.getByLabelText('部門4の証明画像を必須にする')).toBeEnabled())
    fireEvent.click(screen.getByLabelText('部門4の証明画像を必須にする'))
    expect(mocks.update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('設定を保存しました。')
    const options = Object.values(mocks.events[1].division_settings!)
    expect(options[3]).toMatchObject({ name: '新設枠', eligibility: '新設条件', requiresProof: true, order: 3 })
    cleanup(); render(<SettingsPage />)
    expect(await screen.findByLabelText('部門4の名称')).toHaveValue('新設枠')
  })
  it('新規開催は選択中の古い回ではなく最新保存回の構成をコピーする', async () => {
    mocks.events[0].division_settings = { custom: { name: '最新枠', description: '', eligibility: '', requiresProof: false, order: 0 } }
    render(<SettingsPage />)
    await screen.findByDisplayValue('無差別部門')
    fireEvent.change(screen.getByLabelText('部門1の名称'), { target: { value: '未保存' } })
    fireEvent.change(screen.getByLabelText('編集する開催回'), { target: { value: '__new__' } })
    expect(screen.getByLabelText('部門1の名称')).toHaveValue('最新枠')
    expect(screen.queryByLabelText('部門2の名称')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('部門1の名称'), { target: { value: 'コピー編集' } })
    expect(mocks.events[0].division_settings!.custom.name).toBe('最新枠')
  })
  it('初回は1部門の空欄・証明オフで開始する', async () => {
    mocks.events = []; render(<SettingsPage />)
    expect(await screen.findByLabelText('部門1の名称')).toHaveValue('')
    expect(screen.queryByLabelText('部門2の名称')).not.toBeInTheDocument()
    expect(screen.getByLabelText('部門1の証明画像を必須にする')).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('すべての部門名を入力してください。')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('保存失敗時は追加部門と入力を保持し成功扱いしない', async () => {
    mocks.fail = true; render(<SettingsPage />)
    await screen.findByDisplayValue('無差別部門')
    fireEvent.click(screen.getByRole('button', { name: '部門を追加' }))
    fireEvent.change(screen.getByLabelText('部門4の名称'), { target: { value: '保持する枠' } })
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('設定の保存に失敗しました。')
    expect(screen.getByLabelText('部門4の名称')).toHaveValue('保持する枠')
    expect(Object.keys(mocks.events[1].division_settings!)).toHaveLength(3)
  })
  it('別の回の遅延した回答件数で現在の部門の保護を解除しない', async () => {
    let finish!: (result: unknown) => void
    mocks.rpc.mockImplementation((_name, args) => args.p_event_id === 'active' ? new Promise(resolve => { finish = resolve }) : Promise.resolve({ data: { open: 1 }, error: null }))
    render(<SettingsPage />)
    await screen.findByDisplayValue('無差別部門')
    fireEvent.change(screen.getByLabelText('編集する開催回'), { target: { value: 'newest' } })
    await screen.findByText(/回答が1件あります/)
    await act(async () => finish({ data: {}, error: null }))
    expect(screen.getByLabelText('部門1を削除')).toBeDisabled()
    expect(screen.getByLabelText('部門1の証明画像を必須にする')).toBeDisabled()
  })
})
