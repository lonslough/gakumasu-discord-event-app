import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Header() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <header className={`app-header ${isAdmin ? 'admin-header' : ''}`}>
      <NavLink to="/entry" className="brand">
        <span className="brand-mark">S</span>
        <span>強化月間エントリー</span>
      </NavLink>
      <nav
        id="main-navigation"
        className={`${isAdmin ? 'admin-navigation' : ''} ${menuOpen ? 'open' : ''}`}
        aria-label="メインナビゲーション"
      >
        <NavLink to="/entry" onClick={() => setMenuOpen(false)}>
          回答入力
        </NavLink>
        {isAdmin && (
          <NavLink to="/admin/users" onClick={() => setMenuOpen(false)}>
            ユーザー登録
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin/responses" onClick={() => setMenuOpen(false)}>
            回答結果
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin/rules" onClick={() => setMenuOpen(false)}>
            ルール説明変更
          </NavLink>
        )}
      </nav>
      {isAdmin && (
        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
          aria-controls="main-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      )}
      <div className="account">
        <span>
          <small>ログイン中</small>
          {profile?.user_id ?? '読み込み中'}
        </span>
        <button
          className="button secondary small"
          onClick={() => void signOut().then(() => navigate('/login'))}
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
