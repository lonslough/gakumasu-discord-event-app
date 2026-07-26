import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const maxRulesLength = 10000

export function RulesPage() {
  const { session } = useAuth()
  const [rules, setRules] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error: loadError } = await supabase
        .from('event_settings')
        .select('rules_description')
        .eq('id', true)
        .single()
      if (loadError) setError('ルール説明を読み込めませんでした。')
      else setRules(data.rules_description)
      setLoading(false)
    }
    void load()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!session || rules.length > maxRulesLength) return
    setSubmitting(true)
    setMessage('')
    setError('')
    const { error: updateError } = await supabase
      .from('event_settings')
      .update({ rules_description: rules, updated_by: session.user.id })
      .eq('id', true)
    if (updateError) setError('ルール説明の保存に失敗しました。')
    else setMessage('ルール説明を保存しました。')
    setSubmitting(false)
  }

  return (
    <main className="page narrow">
      <div className="page-title">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>ルール説明変更</h1>
          <p>回答入力画面に表示するイベントルールを編集します。</p>
        </div>
      </div>
      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      <section className="card rules-editor-card">
        {loading ? (
          <div className="spinner" />
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="rules-description">
              ルール説明
              <textarea
                id="rules-description"
                className="rules-textarea"
                value={rules}
                maxLength={maxRulesLength}
                onChange={(event) => setRules(event.target.value)}
                placeholder="イベントのルールを入力してください。改行もそのまま回答入力画面に反映されます。"
              />
            </label>
            <div className="rules-editor-footer">
              <span className="muted">{rules.length.toLocaleString()} / {maxRulesLength.toLocaleString()}文字</span>
              <button className="button primary" disabled={submitting}>
                {submitting ? '保存中…' : 'ルール説明を保存'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}
