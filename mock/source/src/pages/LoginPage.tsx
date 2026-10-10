import { useState, type FormEvent, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  validateUserId,
} from '../lib/validation'
import { isConfigured, supabase, mockUsers } from '../lib/supabase'
import { siteAssetUrl, useSiteConfig } from '../lib/siteConfig'
import { ThemeToggle } from '../components/ThemeToggle'
import { useLoginLayout } from '../hooks/useLoginLayout'

export function LoginPage() {
  const siteConfig = useSiteConfig()
  const imageSource = siteAssetUrl(siteConfig.loginImage)
  const layout = useLoginLayout(imageSource)
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [userId, setUserId] = useState('user1')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  if (!loading && session) return <Navigate to="/entry" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const validationError = validateUserId(userId)
    if (validationError) return setError(validationError)
    setSubmitting(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: userId,
    })
    setSubmitting(false)
    if (authError)
      return setError('ユーザーIDまたはパスワードが正しくありません。')
    navigate('/entry')
  }

  const imageMask = layout.imageOverlap
    ? `linear-gradient(to ${layout.narrow ? 'bottom' : 'right'}, #000 0px, #000 ${layout.fadeStart}px, rgba(0, 0, 0, 0.35) ${layout.fadeStart}px, rgba(0, 0, 0, 0.35) 100%)`
    : undefined

  return (
    <main ref={layout.pageRef} className={`login-page ${layout.imageOverlap ? 'login-image-overlap' : ''}`} style={{ height: layout.height, top: layout.top, '--login-form-top': `${layout.formTop}px` } as CSSProperties}>
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>
      <section className="login-panel">
        <img
          ref={layout.imageRef}
          className="login-hero-image"
          src={imageSource}
          onLoad={layout.onImageLoad}
          onError={layout.onImageLoad}
          style={{ left: layout.imageLeft, width: layout.imageWidth, height: layout.imageHeight, maskImage: imageMask, WebkitMaskImage: imageMask }}
          alt="十王星南と雨夜燕 中野絆星のアイドル強化月間 星々のきらめき"
        />
      </section>
      <section ref={layout.formWrapRef} className="login-form-wrap">
        <div ref={layout.contentRef} className="login-right-content">
          <header className="login-copy">
            <div className="event-badge">SERVER EVENT 2026</div>
            <h1>
              強化月間
              <br />
              <span>エントリー</span>
            </h1>
            <p>
              Discordサーバーイベントの回答受付ページです。ユーザーを選択して画面を確認できます。
            </p>
          </header>
          <form className="card login-card" onSubmit={submit} noValidate>
            <h2>ログイン</h2>
            <p className="muted">
              ユーザーを選択してログイン
            </p>
            {!isConfigured && (
              <div className="notice error">
                Supabase環境変数が設定されていません。
              </div>
            )}
            <label>
              ユーザーID
              <select value={userId} onChange={(e) => setUserId(e.target.value)}>{mockUsers.map(user => <option key={user.id} value={user.user_id}>{user.user_id}（{user.role === 'admin' ? '管理者' : '一般ユーザー'}）</option>)}</select>
            </label>
            <label>
              パスワード
              <input
                type="password"
                value="" disabled placeholder="mockでは使用しません" autoComplete="off"
              />
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={submitting || !isConfigured}
            >
              {submitting ? '認証中…' : 'ログイン'}
            </button>
            <p className="security-note">
              mock：変更は再読み込みで初期化されます
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}
