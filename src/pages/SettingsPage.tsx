import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const maxRulesLength = 10000

const toLocalDateTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function SettingsPage() {
  const { session } = useAuth()
  const [rules, setRules] = useState('')
  const [submissionStart, setSubmissionStart] = useState('')
  const [submissionEnd, setSubmissionEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error: loadError } = await supabase
        .from('event_settings')
        .select('rules_description, submission_start_at, submission_end_at')
        .eq('id', true)
        .single()
      if (loadError) setError('ルール説明を読み込めませんでした。')
      else {
        setRules(data.rules_description)
        setSubmissionStart(toLocalDateTime(data.submission_start_at))
        setSubmissionEnd(toLocalDateTime(data.submission_end_at))
      }
      setLoading(false)
    }
    void load()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!session || rules.length > maxRulesLength) return
    if (
      submissionStart &&
      submissionEnd &&
      new Date(submissionStart) >= new Date(submissionEnd)
    ) {
      setError('応募終了日時は応募開始日時より後に設定してください。')
      return
    }
    setSubmitting(true)
    setMessage('')
    setError('')
    const { error: updateError } = await supabase
      .from('event_settings')
      .update({
        rules_description: rules,
        submission_start_at: submissionStart
          ? new Date(submissionStart).toISOString()
          : null,
        submission_end_at: submissionEnd
          ? new Date(submissionEnd).toISOString()
          : null,
        updated_by: session.user.id,
      })
      .eq('id', true)
    if (updateError) setError('設定の保存に失敗しました。')
    else setMessage('設定を保存しました。')
    setSubmitting(false)
  }

  return (
    <main className="page narrow">
      <div className="page-title">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>設定</h1>
          <p>イベントルールと応募受付期間を設定します。</p>
        </div>
      </div>
      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      <section className="card rules-editor-card">
        {loading ? (
          <div className="spinner" />
        ) : (
          <form onSubmit={submit}>
            <fieldset className="settings-section">
              <legend>応募期間</legend>
              <div className="form-grid">
                <label htmlFor="submission-start">
                  応募開始日時
                  <input
                    id="submission-start"
                    type="datetime-local"
                    value={submissionStart}
                    onChange={(event) => setSubmissionStart(event.target.value)}
                  />
                  <small>未設定の場合、開始日時による制限は行いません。</small>
                </label>
                <label htmlFor="submission-end">
                  応募終了日時
                  <input
                    id="submission-end"
                    type="datetime-local"
                    value={submissionEnd}
                    onChange={(event) => setSubmissionEnd(event.target.value)}
                  />
                  <small>終了後は新規回答と回答の更新を受け付けません。</small>
                </label>
              </div>
            </fieldset>
            <div className="settings-section">
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
            </div>
            <div className="rules-editor-footer">
              <span className="muted">{rules.length.toLocaleString()} / {maxRulesLength.toLocaleString()}文字</span>
              <button className="button primary" disabled={submitting}>
                {submitting ? '保存中…' : '設定を保存'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  )
}
