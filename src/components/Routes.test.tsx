import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './Routes'

const auth = vi.hoisted(() => ({
  session: { user: { id: 'self' } } as { user: { id: string } } | null,
  profile: { role: 'user', user_id: 'self' }, loading: false, signOut: vi.fn(),
}))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }))
vi.mock('../pages/LoginPage', () => ({ LoginPage: () => <h1>ログイン画面</h1> }))
vi.mock('../pages/EntryPage', () => ({ EntryPage: () => <h1>入力画面</h1> }))
vi.mock('../pages/HistoryPage', () => ({ HistoryPage: () => <h1>履歴画面</h1> }))
vi.mock('../pages/UsersPage', () => ({ UsersPage: () => <h1>登録画面</h1> }))
vi.mock('../pages/ResponsesPage', () => ({ ResponsesPage: () => <h1>結果画面</h1> }))
vi.mock('../pages/SettingsPage', () => ({ SettingsPage: () => <h1>設定画面</h1> }))
const show = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>)

describe('認証と参加履歴の遷移', () => {
  afterEach(cleanup)
  beforeEach(() => { auth.session = { user: { id: 'self' } }; auth.profile.role = 'user' })
  it('未認証で履歴を開くとログインへ転送', async () => {
    auth.session = null
    show('/history')
    expect(await screen.findByRole('heading', { name: 'ログイン画面' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '参加履歴' })).not.toBeInTheDocument()
  })
  it.each(['user', 'admin'])('%s はヘッダーから参加履歴へ移動できる', async role => {
    auth.profile.role = role
    show('/entry')
    await screen.findByRole('heading', { name: '入力画面' })
    fireEvent.click(screen.getByRole('link', { name: '参加履歴' }))
    expect(await screen.findByRole('heading', { name: '履歴画面' })).toBeInTheDocument()
  })
  it.each(['/admin/users', '/admin/responses', '/admin/settings', '/admin/rules'])('user は %s に入れない', async path => {
    show(path)
    expect(await screen.findByRole('heading', { name: '入力画面' })).toBeInTheDocument()
  })
  it.each([
    ['/admin/users', '登録画面'], ['/admin/responses', '結果画面'],
    ['/admin/settings', '設定画面'], ['/admin/rules', '設定画面'], ['/missing', '入力画面'],
  ])('admin の %s の遷移', async (path, heading) => {
    auth.profile.role = 'admin'
    show(path)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })
})
