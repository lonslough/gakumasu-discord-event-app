import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
  entryDivision: '',
  resultFile: null,
  beginnerProofFile: null,
  loginDaysProofFile: null,
}
const bucket = 'submission-images'
const basename = (path: string) => path.split('/').pop() ?? path

function FileField({
  id,
  label,
  description,
  required = true,
  file,
  existing,
  error,
  onChange,
}: {
  id: string
  label: string
  description?: string
  required?: boolean
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
        {label}{' '}
        {required ? (
          <span className="required">必須</span>
        ) : (
          <span className="optional">任意</span>
        )}
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
  const [urls, setUrls] = useState<{
    result?: string
    beginnerProof?: string
    loginDaysProof?: string
  } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [rules, setRules] = useState('')
  const [rulesLoading, setRulesLoading] = useState(true)
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
      setValues({
        discordUsername: submission.discord_username,
        producerName: submission.producer_name,
        category: submission.category,
        entryDivision: submission.entry_division,
        resultFile: null,
        beginnerProofFile: null,
        loginDaysProofFile: null,
      })
      const resultPath = submission.deck_image_path
        ? null
        : submission.score_image_path
      const imagePaths = [
        resultPath,
        submission.beginner_proof_image_path,
        submission.login_days_proof_image_path,
      ].filter((path): path is string => Boolean(path))
      if (imagePaths.length) {
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrls(imagePaths, 600)
        const signedUrlFor = (path: string | null) => {
          if (!path) return undefined
          return signed?.[imagePaths.indexOf(path)]?.signedUrl ?? undefined
        }
        setUrls({
          result: signedUrlFor(resultPath),
          beginnerProof: signedUrlFor(submission.beginner_proof_image_path),
          loginDaysProof: signedUrlFor(submission.login_days_proof_image_path),
        })
      } else setUrls(null)
    }
    setLoading(false)
  }, [session])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const loadRules = async () => {
      const { data, error } = await supabase
        .from('event_settings')
        .select('rules_description')
        .eq('id', true)
        .single()
      if (error) setFailure('ルール説明の読み込みに失敗しました。')
      else setRules(data.rules_description)
      setRulesLoading(false)
    }
    void loadRules()
  }, [])
  useEffect(() => {
    if (loading || rulesLoading || existing || rulesAutoShown.current) return
    rulesAutoShown.current = true
    setShowingRules(true)
  }, [existing, loading, rulesLoading])

  const requestSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateEntry(values, {
      beginnerProof: Boolean(existing?.beginner_proof_image_path),
      loginDaysProof: Boolean(existing?.login_days_proof_image_path),
    })
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) setConfirming(true)
  }

  const upload = async (
    file: File,
    kind: 'score' | 'beginner-proof' | 'login-days-proof',
  ) => {
    const path = `${session!.user.id}/${kind}/${crypto.randomUUID()}.${fileExtension(file.name)}`
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error('upload')
    return path
  }

  const save = async () => {
    if (!session) return
    const entryDivision = existing?.entry_division ?? values.entryDivision
    setConfirming(false)
    setSubmitting(true)
    setFailure('')
    setMessage('')
    const uploaded: string[] = []
    try {
      const resultPath = values.resultFile
        ? await upload(values.resultFile, 'score')
        : existing?.deck_image_path
          ? null
          : (existing?.score_image_path ?? null)
      if (resultPath && values.resultFile) uploaded.push(resultPath)
      const beginnerProofPath =
        entryDivision === 'beginner'
          ? values.beginnerProofFile
            ? await upload(values.beginnerProofFile, 'beginner-proof')
            : existing?.beginner_proof_image_path
          : null
      if (values.beginnerProofFile && beginnerProofPath)
        uploaded.push(beginnerProofPath)
      const loginDaysProofPath =
        entryDivision === 'beginner'
          ? values.loginDaysProofFile
            ? await upload(values.loginDaysProofFile, 'login-days-proof')
            : existing?.login_days_proof_image_path
          : null
      if (values.loginDaysProofFile && loginDaysProofPath)
        uploaded.push(loginDaysProofPath)
      const { error } = await supabase.from('submissions').upsert(
        {
          user_id: session.user.id,
          discord_username: values.discordUsername.trim(),
          producer_name: values.producerName.trim(),
          category: values.category,
          entry_division: entryDivision,
          score_image_path: resultPath,
          deck_image_path: null,
          beginner_proof_image_path: beginnerProofPath,
          login_days_proof_image_path: loginDaysProofPath,
        },
        { onConflict: 'user_id' },
      )
      if (error) throw new Error('database')
      const oldPaths = [
        values.resultFile || existing?.deck_image_path
          ? existing?.score_image_path
          : null,
        existing?.deck_image_path,
        values.beginnerProofFile ||
        (entryDivision !== 'beginner' && existing?.beginner_proof_image_path)
          ? existing?.beginner_proof_image_path
          : null,
        values.loginDaysProofFile ||
        (entryDivision !== 'beginner' && existing?.login_days_proof_image_path)
          ? existing?.login_days_proof_image_path
          : null,
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
        <div className="page-title-actions">
          <button
            type="button"
            className="button secondary small"
            onClick={() => setShowingRules(true)}
          >
            イベントルールを表示
          </button>
          <span className="step-pill">入力内容は再送信で更新可能</span>
        </div>
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
            <h2>応募部門</h2>
            <fieldset>
              <legend>
                応募部門を選択してください{' '}
                <span className="required">必須</span>
              </legend>
              {existing && (
                <p className="help">応募部門は回答後に変更できません。</p>
              )}
              <div className="radio-cards">
                {(
                  [
                    ['open', '無差別部門', '参加条件なし'],
                    [
                      'switch_off',
                      'スイッチカードOFF部門',
                      'スイッチカードOFF必須',
                    ],
                    ['beginner', '初心者部門', 'スイッチカードOFF必須'],
                  ] as const
                ).map(([value, label, description]) => (
                  <label
                    className={values.entryDivision === value ? 'selected' : ''}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="entryDivision"
                      value={value}
                      checked={values.entryDivision === value}
                      disabled={Boolean(existing)}
                      onChange={() =>
                        setValues({ ...values, entryDivision: value })
                      }
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                  </label>
                ))}
              </div>
              {values.entryDivision === 'beginner' && (
                <p className="help">
                  参加条件：イベント参加時点で「PLv60未満」または「ログイン日数合計90日以下」の方
                </p>
              )}
              {errors.entryDivision && (
                <p className="field-error">{errors.entryDivision}</p>
              )}
            </fieldset>
          </div>
        </section>
        <section className="card form-section">
          <div className="section-number">04</div>
          <div className="section-content">
            <h2>画像アップロード</h2>
            <figure className="image-sample">
              <figcaption>
                評価値と最終所持スキルカードが同時に確認できる、次のような画像を添付してください。
              </figcaption>
              <img
                src={`${import.meta.env.BASE_URL}sample/score_sample.png`}
                alt="評価値・最終所持スキルカード画像の見本"
              />
            </figure>
            <FileField
              id="result"
              label="評価値・最終所持スキルカード"
              required={false}
              file={values.resultFile}
              existing={
                existing?.score_image_path &&
                urls?.result &&
                !existing.deck_image_path
                  ? {
                      name: basename(existing.score_image_path),
                      url: urls.result,
                    }
                  : null
              }
              error={errors.resultFile}
              onChange={(file) => setValues({ ...values, resultFile: file })}
            />
            {values.entryDivision === 'beginner' && (
              <div className="evidence-fields">
                <figure className="image-sample">
                  <figcaption>PID・Pレベル確認画像のサンプル</figcaption>
                  <img
                    src={`${import.meta.env.BASE_URL}sample/PID_Plv_sample.PNG`}
                    alt="PID・Pレベル確認画像の見本"
                  />
                </figure>
                <FileField
                  id="beginner-proof"
                  label="PID・Pレベル確認画像"
                  description="PIDとPレベルの両方がわかる画像を添付してください"
                  file={values.beginnerProofFile}
                  existing={
                    existing?.beginner_proof_image_path && urls?.beginnerProof
                      ? {
                          name: basename(existing.beginner_proof_image_path),
                          url: urls.beginnerProof,
                        }
                      : null
                  }
                  error={errors.beginnerProofFile}
                  onChange={(file) =>
                    setValues({ ...values, beginnerProofFile: file })
                  }
                />
                <figure className="image-sample">
                  <figcaption>出席日数確認のサンプル</figcaption>
                  <img
                    src={`${import.meta.env.BASE_URL}sample/login_days_sample.png`}
                    alt="出席日数画像の見本"
                  />
                </figure>
                <FileField
                  id="login-days-proof"
                  label="出席日数確認画像"
                  description="通知表の出席日数がわかる画像を添付してください"
                  file={values.loginDaysProofFile}
                  existing={
                    existing?.login_days_proof_image_path &&
                    urls?.loginDaysProof
                      ? {
                          name: basename(existing.login_days_proof_image_path),
                          url: urls.loginDaysProof,
                        }
                      : null
                  }
                  error={errors.loginDaysProofFile}
                  onChange={(file) =>
                    setValues({ ...values, loginDaysProofFile: file })
                  }
                />
              </div>
            )}
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
