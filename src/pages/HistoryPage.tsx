import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HistoryImage } from '../components/history/HistoryImage'
import { entryDivisionName, statusName } from '../components/responses/labels'
import { characterLabel, characterRoster } from '../lib/characters'
import { supabase } from '../lib/supabase'
import type { SubmissionHistory } from '../types'

const dateLabel = (value: string) => new Date(value).toLocaleString('ja-JP')

function HistoryCard({ row }: { row: SubmissionHistory }) {
  let scoreLabel = '確認待ち'
  if (row.verification_status === 'invalid') scoreLabel = '対象外'
  if (row.verification_status === 'verified') {
    scoreLabel = row.confirmed_score === null ? '得点未登録' : row.confirmed_score.toLocaleString('ja-JP')
  }
  return (
    <article className="card history-card" aria-labelledby={`history-${row.id}`}>
      <div className="history-card-heading">
        <div>
          {row.is_active && <span className="history-current">現在の開催回</span>}
          <h2 id={`history-${row.id}`}>{row.event_name}</h2>
        </div>
        <span className={`badge ${row.verification_status}`}>{statusName[row.verification_status]}</span>
      </div>
      <div className="history-score"><span>確認済み得点</span><strong>{scoreLabel}</strong></div>
      <dl className="history-details">
        <div><dt>サーバー内ユーザーネーム</dt><dd>{row.discord_username}</dd></div>
        <div><dt>ゲーム内プロデューサーネーム</dt><dd>{row.producer_name}</dd></div>
        <div><dt>育成キャラクター</dt><dd>{characterLabel([...row.character_options, ...characterRoster], row.category)}</dd></div>
        <div><dt>応募部門</dt><dd>{entryDivisionName[row.entry_division]}</dd></div>
        <div><dt>初回提出日時</dt><dd>{dateLabel(row.created_at)}</dd></div>
        <div><dt>最終更新日時</dt><dd>{dateLabel(row.updated_at)}</dd></div>
      </dl>
      <h3>提出画像</h3>
      <div className="history-images">
        <HistoryImage path={row.score_image_path}
          label={row.deck_image_path ? '評価値（旧形式）' : '評価値・最終所持スキルカード'} />
        {row.deck_image_path && <HistoryImage path={row.deck_image_path} label="デッキ（旧形式）" />}
        {(row.entry_division === 'beginner' || row.beginner_proof_image_path) &&
          <HistoryImage path={row.beginner_proof_image_path} label="PID・Pレベル" />}
        {(row.entry_division === 'beginner' || row.login_days_proof_image_path) &&
          <HistoryImage path={row.login_days_proof_image_path} label="総出席日数" />}
      </div>
    </article>
  )
}

export function HistoryPage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [rows, setRows] = useState<SubmissionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setRows([])
    if (!userId) return
    void (async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('list_my_submission_history')
        if (loadError) throw loadError
        if (!cancelled) setRows((data ?? []) as SubmissionHistory[])
      } catch {
        if (!cancelled) setError('参加履歴を読み込めませんでした。再試行してください。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId, attempt])

  return (
    <main className="page narrow">
      <div className="page-title"><div><p className="eyebrow">MY HISTORY</p>
        <h1>参加履歴</h1><p>これまでの参加情報・得点・提出画像を確認できます。</p>
      </div></div>
      <p className="muted">得点は管理者の確認後に表示されます。この画面では回答を編集できません。</p>
      {loading && <p role="status">参加履歴を読み込み中…</p>}
      {!loading && error && <div className="notice error" role="alert">
        <p>{error}</p><button type="button" className="button secondary"
          onClick={() => setAttempt(value => value + 1)}>再試行</button>
      </div>}
      {!loading && !error && rows.length === 0 && <div className="card history-card history-empty">
        <h2>参加履歴はまだありません</h2><p>回答を送信すると、ここに参加情報が表示されます。</p>
        <Link className="button secondary" to="/entry">回答入力へ</Link>
      </div>}
      {!loading && !error && rows.length > 0 && <div className="history-list">
        {rows.map(row => <HistoryCard key={row.id} row={row} />)}
      </div>}
    </main>
  )
}
