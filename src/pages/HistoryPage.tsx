import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { HistoryImage } from '../components/history/HistoryImage'
import { Modal } from '../components/Modal'
import { entryDivisionName, statusName } from '../components/responses/labels'
import { characterLabel, characterRoster } from '../lib/characters'
import { supabase } from '../lib/supabase'
import type { SubmissionHistory } from '../types'

const dateLabel = (value: string) => new Date(value).toLocaleString('ja-JP')

function HistoryRow({ row, onSelect }: { row: SubmissionHistory; onSelect: () => void }) {
  let scoreLabel = '確認待ち'
  if (row.verification_status === 'invalid') scoreLabel = '対象外'
  if (row.verification_status === 'verified') {
    scoreLabel = row.confirmed_score === null ? '得点未登録' : row.confirmed_score.toLocaleString('ja-JP')
  }
  return (
    <tr className="history-row" onClick={onSelect}>
      <th scope="row">
        <button type="button" className="history-record-button" aria-haspopup="dialog"
          aria-label={`${row.event_name}の提出画像を表示`}
          onClick={event => { event.stopPropagation(); onSelect() }}>{row.event_name}</button>
        {row.is_active && <span className="history-current">現在の開催回</span>}
      </th>
      <td><span className={`badge ${row.verification_status}`}>{statusName[row.verification_status]}</span></td>
      <td className="history-score-cell">{scoreLabel}</td>
      <td>{row.discord_username}</td>
      <td>{row.producer_name}</td>
      <td>{characterLabel([...row.character_options, ...characterRoster], row.category)}</td>
      <td>{entryDivisionName[row.entry_division]}</td>
      <td>{dateLabel(row.created_at)}</td>
      <td>{dateLabel(row.updated_at)}</td>
    </tr>
  )
}

function HistoryImages({ row }: { row: SubmissionHistory }) {
  return (
      <div className="history-images">
        <HistoryImage initiallyOpen path={row.score_image_path}
          label={row.deck_image_path ? '評価値（旧形式）' : '評価値・最終所持スキルカード'} />
        {row.deck_image_path && <HistoryImage initiallyOpen path={row.deck_image_path} label="デッキ（旧形式）" />}
        {(row.entry_division === 'beginner' || row.beginner_proof_image_path) &&
          <HistoryImage initiallyOpen path={row.beginner_proof_image_path} label="PID・Pレベル" />}
        {(row.entry_division === 'beginner' || row.login_days_proof_image_path) &&
          <HistoryImage initiallyOpen path={row.login_days_proof_image_path} label="総出席日数" />}
      </div>
  )
}

export function HistoryPage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [rows, setRows] = useState<SubmissionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedRow = rows.find(row => row.id === selectedId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setRows([])
    setSelectedId(null)
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
    <main className="page history-page">
      <div className="page-title"><div><p className="eyebrow">MY HISTORY</p>
        <h1>参加履歴</h1>
      </div></div>
      {loading && <p role="status">参加履歴を読み込み中…</p>}
      {!loading && error && <div className="notice error" role="alert">
        <p>{error}</p><button type="button" className="button secondary"
          onClick={() => setAttempt(value => value + 1)}>再試行</button>
      </div>}
      {!loading && !error && rows.length === 0 && <div className="card history-card history-empty">
        <h2>参加履歴はまだありません</h2><p>回答を送信すると、ここに参加情報が表示されます。</p>
        <Link className="button secondary" to="/entry">回答入力へ</Link>
      </div>}
      {!loading && !error && rows.length > 0 && <div className="history-table-scroll"
        role="region" aria-label="参加履歴一覧" tabIndex={0}>
        <table className="history-table" aria-label="参加履歴">
          <thead><tr>
            {['開催回', '確認状態', '確認済み得点', 'サーバー内ユーザーネーム',
              'ゲーム内プロデューサーネーム', '育成キャラクター', '応募部門', '初回提出日時', '最終更新日時']
              .map(label => <th key={label} scope="col">{label}</th>)}
          </tr></thead>
          <tbody>{rows.map(row => <HistoryRow key={row.id} row={row} onSelect={() => setSelectedId(row.id)} />)}</tbody>
        </table>
      </div>}
      {selectedRow && <Modal title={`${selectedRow.event_name}の提出画像`} wide onClose={() => setSelectedId(null)}>
        <HistoryImages key={selectedRow.id} row={selectedRow} />
      </Modal>}
    </main>
  )
}
