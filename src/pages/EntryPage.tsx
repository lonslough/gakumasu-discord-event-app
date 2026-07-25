import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  fileExtension,
  validateEntry,
  type EntryValues,
} from '../lib/validation'
import type { Submission } from '../types'

const initialValues: EntryValues = {
  discordUsername: '',
  producerName: '',
  category: '',
  scoreFile: null,
  deckFile: null,
}
const bucket = 'submission-images'
const basename = (path: string) => path.split('/').pop() ?? path

function FileField({
  id,
  label,
  description,
  file,
  existing,
  error,
  onChange,
}: {
  id: string
  label: string
  description?: string
  file: File | null
  existing?: { name: string; url: string } | null
  error?: string
  onChange: (file: File | null) => void
}) {
  const preview =
    file && ['image/jpeg', 'image/png'].includes(file.type)
      ? URL.createObjectURL(file)
      : existing?.url
  return (
    <div className="file-block">
      <label htmlFor={id}>
        {label} <span className="required">必須</span>
      </label>
      {description && <p className="help">{description}</p>}
      <label className={`file-drop ${error ? 'invalid' : ''}`} htmlFor={id}>
        <span className="upload-icon">↑</span>
        <strong>{file ? file.name : '画像を選択'}</strong>
        <small>JPG / PNG / HEIC / HEIF・最大10MB</small>
        <input
          id={id}
          type="file"
          accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {preview && (
        <a href={preview} target="_blank" rel="noreferrer">
          <img
            className="entry-preview"
            src={preview}
            alt={`${label}のプレビュー`}
          />
        </a>
      )}
      {!file && existing && (
        <p className="existing-file">
          登録済み:{' '}
          <a href={existing.url} target="_blank" rel="noreferrer">
            {existing.name}
          </a>
        </p>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export function EntryPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [values, setValues] = useState<EntryValues>(initialValues)
  const [existing, setExisting] = useState<Submission | null>(null)
  const [urls, setUrls] = useState<{ score: string; deck: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')

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
      setValues({
        discordUsername: submission.discord_username,
        producerName: submission.producer_name,
        category: submission.category,
        scoreFile: null,
        deckFile: null,
      })
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrls(
          [submission.score_image_path, submission.deck_image_path],
          600,
        )
      if (signed?.[0]?.signedUrl && signed?.[1]?.signedUrl)
        setUrls({ score: signed[0].signedUrl, deck: signed[1].signedUrl })
    }
    setLoading(false)
  }, [session])
  useEffect(() => {
    void load()
  }, [load])

  const requestSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateEntry(values, Boolean(existing))
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) setConfirming(true)
  }

  const upload = async (file: File, kind: 'score' | 'deck') => {
    const path = `${session!.user.id}/${kind}/${crypto.randomUUID()}.${fileExtension(file.name)}`
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error('upload')
    return path
  }

  const save = async () => {
    if (!session) return
    setConfirming(false)
    setSubmitting(true)
    setFailure('')
    setMessage('')
    const uploaded: string[] = []
    try {
      const scorePath = values.scoreFile
        ? await upload(values.scoreFile, 'score')
        : existing!.score_image_path
      if (values.scoreFile) uploaded.push(scorePath)
      const deckPath = values.deckFile
        ? await upload(values.deckFile, 'deck')
        : existing!.deck_image_path
      if (values.deckFile) uploaded.push(deckPath)
      const { error } = await supabase.from('submissions').upsert(
        {
          user_id: session.user.id,
          discord_username: values.discordUsername.trim(),
          producer_name: values.producerName.trim(),
          category: values.category,
          score_image_path: scorePath,
          deck_image_path: deckPath,
        },
        { onConflict: 'user_id' },
      )
      if (error) throw new Error('database')
      const oldPaths = [
        values.scoreFile ? existing?.score_image_path : null,
        values.deckFile ? existing?.deck_image_path : null,
      ].filter((path): path is string => Boolean(path))
      if (oldPaths.length) await supabase.storage.from(bucket).remove(oldPaths)
      setMessage('回答を保存しました。')
      await load()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      if (uploaded.length) await supabase.storage.from(bucket).remove(uploaded)
      setFailure(
        error instanceof Error && error.message === 'upload'
          ? '画像のアップロードに失敗しました。通信状態を確認してください。'
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
      <div className="page-title">
        <div>
          <p className="eyebrow">EVENT ENTRY</p>
          <h1>回答入力</h1>
          <p>イベントへの応募情報と確認画像を登録してください。</p>
        </div>
        <span className="step-pill">入力内容は再送信で更新可能</span>
      </div>
      {(location.state as { denied?: boolean } | null)?.denied && (
        <div className="notice error">管理画面を表示する権限がありません。</div>
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
        <section className="card form-section">
          <div className="section-number">01</div>
          <div className="section-content">
            <h2>参加者情報</h2>
            <div className="form-grid">
              <label>
                サーバー内ユーザーネーム <span className="required">必須</span>
                <input
                  value={values.discordUsername}
                  maxLength={100}
                  onChange={(e) =>
                    setValues({ ...values, discordUsername: e.target.value })
                  }
                />
                {errors.discordUsername && (
                  <span className="field-error">{errors.discordUsername}</span>
                )}
              </label>
              <label>
                ゲーム内プロデューサーネーム{' '}
                <span className="required">必須</span>
                <input
                  value={values.producerName}
                  maxLength={100}
                  onChange={(e) =>
                    setValues({ ...values, producerName: e.target.value })
                  }
                />
                {errors.producerName && (
                  <span className="field-error">{errors.producerName}</span>
                )}
              </label>
            </div>
          </div>
        </section>
        <section className="card form-section">
          <div className="section-number">02</div>
          <div className="section-content">
            <h2>育成キャラクター</h2>
            <fieldset>
              <legend>
                育成キャラクターを選択してください{' '}
                <span className="required">必須</span>
              </legend>
              <div className="radio-cards">
                {(
                  [
                    ['sena', '十王星南', 'SENA'],
                    ['tsubame', '雨夜燕', 'TSUBAME'],
                  ] as const
                ).map(([value, label, sub]) => (
                  <label
                    className={values.category === value ? 'selected' : ''}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={value}
                      checked={values.category === value}
                      onChange={() => setValues({ ...values, category: value })}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{sub} CATEGORY</small>
                    </span>
                  </label>
                ))}
              </div>
              {errors.category && (
                <p className="field-error">{errors.category}</p>
              )}
            </fieldset>
          </div>
        </section>
        <section className="card form-section">
          <div className="section-number">03</div>
          <div className="section-content">
            <h2>画像アップロード</h2>
            <div className="form-grid">
              <FileField
                id="score"
                label="評価値画像"
                file={values.scoreFile}
                existing={
                  existing && urls
                    ? {
                      name: basename(existing.score_image_path),
                      url: urls.score,
                    }
                    : null
                }
                error={errors.scoreFile}
                onChange={(file) => setValues({ ...values, scoreFile: file })}
              />
              <FileField
                id="deck"
                label="最終デッキ画像"
                description="メモリーのデッキが確認できる画像を添付してください"
                file={values.deckFile}
                existing={
                  existing && urls
                    ? {
                      name: basename(existing.deck_image_path),
                      url: urls.deck,
                    }
                    : null
                }
                error={errors.deckFile}
                onChange={(file) => setValues({ ...values, deckFile: file })}
              />
            </div>
          </div>
        </section>
        <button className="button primary submit-button" disabled={submitting}>
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
              <button className="button primary" onClick={() => void save()}>
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
    </main>
  )
}
