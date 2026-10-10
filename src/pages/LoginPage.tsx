import { useState, type FormEvent, type CSSProperties } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  internalEmail,
  normalizeUserId,
  validateUserId,
} from '../lib/validation'
import { isConfigured, supabase } from '../lib/supabase'
import { siteAssetUrl, useSiteConfig } from '../lib/siteConfig'
import { ThemeToggle } from '../components/ThemeToggle'
import { useLoginLayout } from '../hooks/useLoginLayout'

export function LoginPage() {
  const siteConfig = useSiteConfig()
  const imageSource = siteAssetUrl(siteConfig.loginImage)
  const layout = useLoginLayout(imageSource)
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  if (!loading && session) return <Navigate to="/entry" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const validationError = validateUserId(userId)
    if (validationError) return setError(validationError)
    if (!password) return setError('パスワードを入力してください。')
    setSubmitting(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: internalEmail(userId),
      password,
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
              Discordサーバーイベントの回答受付ページです。管理者から受け取った情報でログインしてください。
            </p>
          </header>
          <form className="card login-card" onSubmit={submit} noValidate>
            <h2>ログイン</h2>
            <p className="muted">
              発行されたユーザーIDとパスワードを入力
            </p>
            {!isConfigured && (
              <div className="notice error">
                Supabase環境変数が設定されていません。
              </div>
            )}
            <label>
              ユーザーID
              <input
                value={userId}
                onChange={(e) => setUserId(normalizeUserId(e.target.value))}
                autoComplete="username"
                maxLength={32}
              />
            </label>
            <label>
              パスワード
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
              認証情報は暗号化された通信で送信されます
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}
