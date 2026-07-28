import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { supabase } from '../lib/supabase'
import { normalizeUserId, validateUserId } from '../lib/validation'
import type { UserSummary } from '../types'

interface Credential {
  userId: string
  password: string
}

export function UsersPage() {
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [credential, setCredential] = useState<Credential | null>(null)
  const [existingId, setExistingId] = useState('')
  const [resetTarget, setResetTarget] = useState('')
  const [copiedInvitation, setCopiedInvitation] = useState(false)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc('list_user_summaries')
    if (loadError) setError('ユーザー一覧を読み込めませんでした。')
    else setUsers((data ?? []) as UserSummary[])
    setLoading(false)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const invoke = async (
    name: 'create-user' | 'reset-user-password',
    target: string,
  ) => {
    setSubmitting(true)
    setError('')
    const { data, error: functionError } = await supabase.functions.invoke(
      name,
      { body: { userId: target } },
    )
    setSubmitting(false)
    if (functionError || !data) {
      setError(
        name === 'create-user'
          ? 'ユーザー登録に失敗しました。'
          : 'パスワード再発行に失敗しました。',
      )
      return
    }
    if (data.status === 'already_exists') {
      setExistingId(data.userId)
      return
    }
    setCredential({ userId: data.userId, password: data.password })
    setUserId('')
    setExistingId('')
    setResetTarget('')
    await load()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const validationError = validateUserId(userId)
    if (validationError) return setError(validationError)
    void invoke('create-user', normalizeUserId(userId))
  }
  const reset = () => {
    const target = resetTarget
    setResetTarget('')
    void invoke('reset-user-password', target)
  }
  const copyInvitation = async (issued: Credential) => {
    const invitation = `ご参加ありがとうございます。
以下の情報からログインをしていただき回答をお願いします！
ID：\`${issued.userId}\`
🔑：||${issued.password}||
URL：https://lonslough.github.io/gakumasu-server-event-app`
    await navigator.clipboard.writeText(invitation)
    setCopiedInvitation(true)
  }

  return (
    <main className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>ユーザー登録</h1>
          <p>参加者のログイン情報を安全に発行します。</p>
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="admin-layout">
        <section className="card admin-side">
          <h2>新しいユーザー</h2>
          <p className="muted">
            ユーザーIDを入力すると、安全なパスワードを自動生成します。
          </p>
          <form onSubmit={submit}>
            <label>
              ユーザーID
              <input
                value={userId}
                onChange={(e) => setUserId(normalizeUserId(e.target.value))}
                placeholder="example-user"
                maxLength={32}
              />
              <small>3〜32文字・半角英数字・-・_</small>
            </label>
            <button className="button primary full" disabled={submitting}>
              {submitting ? '処理中…' : '確認'}
            </button>
          </form>
          {existingId && (
            <div className="inline-result">
              <strong>このユーザーIDは登録済みです。</strong>
              <button
                className="button danger full"
                onClick={() => setResetTarget(existingId)}
              >
                パスワードを再発行
              </button>
            </div>
          )}
        </section>
        <section className="card table-card">
          <div className="table-heading">
            <div>
              <h2>最近登録したユーザー</h2>
              <p>{users.length}名</p>
            </div>
            <button
              className="button secondary small"
              onClick={() => void load()}
            >
              更新
            </button>
          </div>
          {loading ? (
            <div className="spinner" />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ユーザーID</th>
                    <th>権限</th>
                    <th>登録日時</th>
                    <th>回答</th>
                    <th>最終回答日時</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.user_id}</strong>
                      </td>
                      <td>
                        <span className={`status ${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        {new Date(user.created_at).toLocaleString('ja-JP')}
                      </td>
                      <td>
                        {user.has_submission ? (
                          <span className="status verified">回答済み</span>
                        ) : (
                          <span className="status pending">未回答</span>
                        )}
                      </td>
                      <td>
                        {user.last_submitted_at
                          ? new Date(user.last_submitted_at).toLocaleString(
                              'ja-JP',
                            )
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {credential && (
        <Modal
          title="ログイン情報を発行しました"
          onClose={() => {
            setCredential(null)
            setCopiedInvitation(false)
          }}
          actions={
            <button
              className="button primary"
              onClick={() => {
                setCredential(null)
                setCopiedInvitation(false)
              }}
            >
              閉じる
            </button>
          }
        >
          <div className="notice warning">
            このパスワードを確認できるのは今だけです。安全な方法で参加者へ共有してください。
          </div>
          <dl className="credentials">
            <dt>ユーザーID</dt>
            <dd>{credential.userId}</dd>
            <dt>発行パスワード</dt>
            <dd>
              <code>{credential.password}</code>
              <button
                className="button secondary small"
                onClick={() =>
                  void navigator.clipboard.writeText(credential.password)
                }
              >
                コピー
              </button>
            </dd>
          </dl>
          <button
            className="button secondary full"
            onClick={() => void copyInvitation(credential)}
          >
            案内文を丸ごとコピー
          </button>
          {copiedInvitation && (
            <p className="success-text" role="status">
              案内文をコピーしました。
            </p>
          )}
          <p className="success-text">新しいユーザーを登録しました。</p>
        </Modal>
      )}
      {resetTarget && (
        <Modal
          title="パスワードの再発行"
          onClose={() => setResetTarget('')}
          actions={
            <>
              <button
                className="button secondary"
                onClick={() => setResetTarget('')}
              >
                キャンセル
              </button>
              <button className="button danger" onClick={reset}>
                再発行する
              </button>
            </>
          }
        >
          <p>
            パスワードを再発行すると、現在のパスワードではログインできなくなります。再発行しますか？
          </p>
        </Modal>
      )}
    </main>
  )
}
