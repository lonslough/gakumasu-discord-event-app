import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { EntryFormFields } from '../components/entry/EntryFormFields'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import {
  createInitialEntryValues,
  entryValuesFromSubmission,
  getSettingsRefreshDelay,
  saveEntry,
} from '../lib/entryService'
import { supabase } from '../lib/supabase'
import { validateEntry, type EntryValues } from '../lib/validation'
import type { EventSettings, Submission } from '../types'

const formatPeriodDate = (value: string) =>
  new Date(value).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export function EntryPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [values, setValues] = useState<EntryValues>(createInitialEntryValues)
  const [existing, setExisting] = useState<Submission | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [rules, setRules] = useState('')
  const [rulesLoading, setRulesLoading] = useState(true)
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null)
  const [showingRules, setShowingRules] = useState(false)
  const rulesAutoShown = useRef(false)

  const load = useCallback(async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (error) setFailure('回答情報の読み込みに失敗しました。')
    if (data) {
      const submission = data as Submission
      setExisting(submission)
      setValues(entryValuesFromSubmission(submission))
    }
    setLoading(false)
  }, [session])
  useEffect(() => {
    void load()
  }, [load])
  const loadEventSettings = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_event_settings')
    if (error || !data) {
      setFailure('イベント設定の読み込みに失敗しました。')
      setRulesLoading(false)
      return null
    }
    const settings = data as EventSettings
    setRules(settings.rules_description)
    setEventSettings(settings)
    setRulesLoading(false)
    return settings
  }, [])
  useEffect(() => {
    void loadEventSettings()
  }, [loadEventSettings])
  useEffect(() => {
    if (!eventSettings) return
    const delay = getSettingsRefreshDelay(
      eventSettings.server_now,
      eventSettings.submission_start_at,
      eventSettings.submission_end_at,
    )
    if (delay === null) return
    const timer = window.setTimeout(() => void loadEventSettings(), delay)
    return () => window.clearTimeout(timer)
  }, [eventSettings, loadEventSettings])
  useEffect(() => {
    if (loading || rulesLoading || existing || rulesAutoShown.current) return
    rulesAutoShown.current = true
    setShowingRules(true)
  }, [existing, loading, rulesLoading])

  const requestSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!eventSettings?.accepting_submissions) {
      setFailure('現在は応募期間外のため、回答を送信できません。')
      return
    }
    const nextErrors = validateEntry(values, {
      beginnerProof: Boolean(existing?.beginner_proof_image_path),
      loginDaysProof: Boolean(existing?.login_days_proof_image_path),
    })
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) setConfirming(true)
  }

  const save = async () => {
    if (!session) return
    setConfirming(false)
    setSubmitting(true)
    setFailure('')
    setMessage('')
    try {
      const latestSettings = await loadEventSettings()
      if (!latestSettings?.accepting_submissions) throw new Error('period')
      await saveEntry({ userId: session.user.id, values, existing })
      setMessage('回答を保存しました。')
      await load()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      let saveError = error
      if (
        error instanceof Error &&
        (error.message === 'upload' || error.message === 'database')
      ) {
        const latestSettings = await loadEventSettings()
        if (latestSettings && !latestSettings.accepting_submissions)
          saveError = new Error('period')
      }
      setFailure(
        saveError instanceof Error
          ? saveError.message === 'compression'
            ? '画像を圧縮できませんでした。別の画像形式でお試しください。'
            : saveError.message === 'period'
              ? '現在は応募期間外のため、回答を送信できません。'
              : saveError.message === 'upload'
                ? '画像のアップロードに失敗しました。通信状態を確認してください。'
              : '回答の保存に失敗しました。入力内容は維持されています。'
          : '回答の保存に失敗しました。入力内容は維持されています。',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading)
    return (
      <main className="page">
        <div className="spinner" />
      </main>
    )
  return (
    <main className="page narrow">
      <div className="entry-title-art" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}images/tsubame-sena-title2.png`}
          alt=""
        />
      </div>
      <div className="page-title">
        <div>
          <p className="eyebrow">EVENT ENTRY</p>
          <h1>回答入力</h1>
          <p>イベントへの応募情報と確認画像を登録してください。</p>
        </div>
        <div className="page-title-actions">
          <button
            type="button"
            className="button rules-button small"
            onClick={() => setShowingRules(true)}
          >
            イベントルールを表示
          </button>
          {/* <span className="step-pill">入力内容は再送信で更新可能</span> */}
        </div>
      </div>
      {(location.state as { denied?: boolean } | null)?.denied && (
        <div className="notice error">管理画面を表示する権限がありません。</div>
      )}
      {eventSettings && !eventSettings.accepting_submissions && (
        <div className="notice error" role="status">
          {eventSettings.submission_start_at &&
          new Date(eventSettings.server_now) <
            new Date(eventSettings.submission_start_at)
            ? `応募受付は${formatPeriodDate(eventSettings.submission_start_at)}から開始します。現在は回答を入力・送信できません。`
            : `応募受付は${
                eventSettings.submission_end_at
                  ? formatPeriodDate(eventSettings.submission_end_at)
                  : ''
              }に終了しました。現在は回答を入力・更新できません。`}
        </div>
      )}
      {existing && (
        <div className="notice warning">
          すでに回答が登録されています。再度送信すると、以前の回答が上書きされます。
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}
      {failure && (
        <div className="notice error" role="alert">
          {failure}
        </div>
      )}
      <form onSubmit={requestSubmit} noValidate>
        <fieldset
          className="entry-form-fields"
          disabled={!eventSettings?.accepting_submissions}
        >
        <EntryFormFields
          values={values}
          errors={errors}
          existing={existing}
          characters={eventSettings?.character_options ?? []}
          onChange={(patch) =>
            setValues((current) => ({ ...current, ...patch }))
          }
        />
        </fieldset>
        <button
          className="button primary submit-button"
          disabled={submitting || !eventSettings?.accepting_submissions}
        >
          {submitting
            ? '送信中…'
            : existing
              ? '回答を上書きする'
              : '回答を送信する'}
        </button>
      </form>
      {confirming && (
        <Modal
          title="送信内容の確認"
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button
                className="button secondary"
                onClick={() => setConfirming(false)}
              >
                キャンセル
              </button>
              <button
                className="button primary"
                disabled={!eventSettings?.accepting_submissions}
                onClick={() => void save()}
              >
                確認
              </button>
            </>
          }
        >
          <p>
            {existing
              ? 'すでに登録されている回答を上書きします。以前の内容には戻せません。よろしいですか？'
              : 'この内容で回答を送信します。よろしいですか？'}
          </p>
        </Modal>
      )}
      {showingRules && (
        <Modal
          title="イベントルール"
          wide
          onClose={() => setShowingRules(false)}
          actions={
            <button
              className="button primary"
              onClick={() => setShowingRules(false)}
            >
              確認しました
            </button>
          }
        >
          {rules ? (
            <p className="rules-description rules-modal-description">{rules}</p>
          ) : (
            <p className="muted">現在、ルール説明は登録されていません。</p>
          )}
        </Modal>
      )}
    </main>
  )
}
