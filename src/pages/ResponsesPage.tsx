import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { rankedByCategory } from '../lib/ranking'
import { supabase } from '../lib/supabase'
import type { AdminSubmission, VerificationStatus } from '../types'

const categoryName = { seina: '十王星南', tsubame: '雨夜燕' }
const statusName = { pending: '未確認', verified: '確認済み', invalid: '無効' }
const baseName = (path: string) => path.split('/').pop() ?? path

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export function ResponsesPage() {
  const { session } = useAuth()
  const [rows, setRows] = useState<AdminSubmission[]>([])
  const [registered, setRegistered] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('updated')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<AdminSubmission | null>(null)
  const [score, setScore] = useState('')
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const [note, setNote] = useState('')
  const [image, setImage] = useState<{ url: string; name: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const [{ data, error: rowsError }, { data: countData }] = await Promise.all([
      supabase.rpc('list_admin_submissions'),
      supabase.rpc('count_registered_users'),
    ])
    if (rowsError) setError('回答一覧を読み込めませんでした。')
    else setRows((data ?? []) as AdminSubmission[])
    setRegistered(Number(countData ?? 0))
  }, [])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesSearch = !query || [row.discord_username, row.producer_name, row.profile.user_id].some((value) => value.toLowerCase().includes(query))
      const matchesFilter = filter === 'all' || row.category === filter || (row.review?.verification_status ?? 'pending') === filter
      return matchesSearch && matchesFilter
    }).sort((a, b) => {
      if (sort === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'score') return (b.review?.confirmed_score ?? -Infinity) - (a.review?.confirmed_score ?? -Infinity)
      if (sort === 'name') return a.discord_username.localeCompare(b.discord_username, 'ja')
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [rows, search, filter, sort])

  const openImage = async (path: string) => {
    const { data, error: signedError } = await supabase.storage.from('submission-images').createSignedUrl(path, 300)
    if (signedError) return setError('画像を開けませんでした。')
    setImage({ url: data.signedUrl, name: baseName(path) })
  }
  const edit = (row: AdminSubmission) => {
    setEditing(row); setScore(row.review?.confirmed_score?.toString() ?? ''); setStatus(row.review?.verification_status ?? 'pending'); setNote(row.review?.admin_note ?? '')
  }
  const saveReview = async () => {
    if (!editing || !session) return
    const numericScore = score.trim() ? Number(score) : null
    if (numericScore !== null && (!Number.isSafeInteger(numericScore) || numericScore < 0)) return setError('評価値は0以上の整数で入力してください。')
    setSaving(true)
    const { error: saveError } = await supabase.from('submission_reviews').upsert({
      submission_id: editing.id, confirmed_score: numericScore, verification_status: status, admin_note: note.trim(),
      verified_at: status === 'verified' ? new Date().toISOString() : null,
      verified_by: status === 'verified' ? session.user.id : null,
    })
    setSaving(false)
    if (saveError) return setError('確認結果を保存できませんでした。')
    setEditing(null); await load()
  }
  const downloadCsv = () => {
    const header = ['ユーザーID', 'サーバー内ユーザーネーム', 'ゲーム内プロデューサーネーム', '応募部門', '確認済み評価値', '確認状態', '管理者メモ', '初回回答日時', '最終更新日時']
    const lines = filtered.map((row) => [row.profile.user_id, row.discord_username, row.producer_name, categoryName[row.category], row.review?.confirmed_score, statusName[row.review?.verification_status ?? 'pending'], row.review?.admin_note, row.created_at, row.updated_at].map(csvCell).join(','))
    const blob = new Blob([`\uFEFF${header.map(csvCell).join(',')}\r\n${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `responses-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(anchor.href)
  }
  const rankings = { seina: rankedByCategory(rows, 'seina'), tsubame: rankedByCategory(rows, 'tsubame') }
  const verified = rows.filter((row) => row.review?.verification_status === 'verified').length

  return (
    <main className="page wide-page">
      <div className="page-title"><div><p className="eyebrow">RESULTS & VERIFICATION</p><h1>回答結果</h1><p>提出内容の確認、評価値の登録、集計を行います。</p></div><button className="button primary" onClick={downloadCsv}>CSV出力</button></div>
      {error && <div className="notice error">{error}</div>}
      <div className="stats-grid">{[
        ['登録ユーザー数', registered], ['回答者数', rows.length], ['未回答者数', Math.max(0, registered - rows.length)],
        ['十王星南部門', rows.filter((r) => r.category === 'seina').length], ['雨夜燕部門', rows.filter((r) => r.category === 'tsubame').length],
      ].map(([label, value]) => <div className="stat card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <section className="rankings">{(['seina', 'tsubame'] as const).map((category) => <div className="card ranking" key={category}><div className="ranking-title"><h2>{categoryName[category]}ランキング</h2><span>確認済みのみ</span></div>
        {rankings[category].length ? <ol>{rankings[category].slice(0, 10).map((row, index) => <li className={index < 3 ? `top top-${index + 1}` : ''} key={row.id}><span className="rank">{index + 1}</span><span><strong>{row.discord_username}</strong><small>{row.producer_name}</small></span><b>{row.review?.confirmed_score?.toLocaleString()}</b></li>)}</ol> : <p className="empty">ランキング対象の回答はありません。</p>}
      </div>)}</section>
      <section className="card table-card">
        <div className="table-heading"><div><h2>回答一覧</h2><p>{filtered.length}件表示・確認済み {verified}件</p></div></div>
        <div className="filters"><input type="search" placeholder="ユーザー名・IDで検索" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="絞り込み" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">すべて</option><option value="seina">十王星南</option><option value="tsubame">雨夜燕</option><option value="pending">未確認</option><option value="verified">確認済み</option><option value="invalid">無効</option></select>
          <select aria-label="並び替え" value={sort} onChange={(e) => setSort(e.target.value)}><option value="updated">最終更新日時</option><option value="created">回答日時</option><option value="score">確認済み評価値</option><option value="name">ユーザー名</option></select>
        </div>
        <div className="table-scroll"><table><thead><tr><th>参加者</th><th>部門</th><th>評価値</th><th>画像</th><th>初回回答</th><th>最終更新</th><th>状態</th><th>操作</th></tr></thead>
          <tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.discord_username}</strong><small>{row.producer_name} / {row.profile.user_id}</small></td><td>{categoryName[row.category]}</td><td className="score">{row.review?.confirmed_score?.toLocaleString() ?? '—'}</td><td><button className="link-button" onClick={() => void openImage(row.score_image_path)}>評価値</button> / <button className="link-button" onClick={() => void openImage(row.deck_image_path)}>デッキ</button></td><td>{new Date(row.created_at).toLocaleString('ja-JP')}</td><td>{new Date(row.updated_at).toLocaleString('ja-JP')}</td><td><span className={`status ${row.review?.verification_status ?? 'pending'}`}>{statusName[row.review?.verification_status ?? 'pending']}</span></td><td><button className="button secondary small" onClick={() => edit(row)}>確認・編集</button></td></tr>)}</tbody>
        </table></div>
      </section>
      {editing && <Modal title="回答の確認" wide onClose={() => setEditing(null)} actions={<><button className="button secondary" onClick={() => setEditing(null)}>キャンセル</button><button className="button primary" disabled={saving} onClick={() => void saveReview()}>{saving ? '保存中…' : '保存'}</button></>}>
        <div className="review-grid"><label>確認済み評価値<input type="number" min="0" step="1" value={score} onChange={(e) => setScore(e.target.value)} /></label><label>確認状態<select value={status} onChange={(e) => setStatus(e.target.value as VerificationStatus)}><option value="pending">未確認</option><option value="verified">確認済み</option><option value="invalid">無効</option></select></label></div>
        <label>管理者メモ<textarea rows={4} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} /></label>
      </Modal>}
      {image && <Modal title={image.name} wide onClose={() => setImage(null)} actions={<a className="button primary" href={image.url} target="_blank" rel="noreferrer">新しいタブで開く</a>}><img className="large-image" src={image.url} alt={image.name} /></Modal>}
    </main>
  )
}
