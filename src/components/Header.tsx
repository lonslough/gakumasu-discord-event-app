import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Header() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <header className="app-header">
      <NavLink to="/entry" className="brand"><span className="brand-mark">S</span><span>強化月間エントリー</span></NavLink>
      <nav aria-label="メインナビゲーション">
        <NavLink to="/entry">回答入力</NavLink>
        {profile?.role === 'admin' && <NavLink to="/admin/users">ユーザー登録</NavLink>}
        {profile?.role === 'admin' && <NavLink to="/admin/responses">回答結果</NavLink>}
      </nav>
      <div className="account">
        <span><small>ログイン中</small>{profile?.user_id ?? '読み込み中'}</span>
        <button className="button secondary small" onClick={() => void signOut().then(() => navigate('/login'))}>ログアウト</button>
      </div>
    </header>
  )
}
