import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ImageModal,
  ReviewModal,
  type SubmissionImage,
} from '../components/responses/ResponseModals'
import { ResponseRankings } from '../components/responses/ResponseRankings'
import { ResponseStats } from '../components/responses/ResponseStats'
import { ResponsesTable } from '../components/responses/ResponsesTable'
import { categoryName, statusName } from '../components/responses/labels'
import { useAuth } from '../contexts/AuthContext'
import {
  csvCell,
  filterAndSortResponses,
  getResponseStats,
  isValidConfirmedScore,
  parseConfirmedScore,
  type ResponseFilter,
  type ResponseSort,
} from '../lib/adminResponses'
import { rankedByCategory } from '../lib/ranking'
import { supabase } from '../lib/supabase'
import type { AdminSubmission, VerificationStatus } from '../types'

const baseName = (path: string) => path.split('/').pop() ?? path

export function ResponsesPage() {
  const { session } = useAuth()
  const [rows, setRows] = useState<AdminSubmission[]>([])
  const [registered, setRegistered] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ResponseFilter>('all')
  const [sort, setSort] = useState<ResponseSort>('updated')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<AdminSubmission | null>(null)
  const [score, setScore] = useState('')
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const [note, setNote] = useState('')
  const [image, setImage] = useState<SubmissionImage | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setError('')
    const [{ data, error: rowsError }, { data: countData }] = await Promise.all(
      [
        supabase.rpc('list_admin_submissions'),
        supabase.rpc('count_registered_users'),
      ],
    )
    if (rowsError) setError('回答一覧を読み込めませんでした。')
    else setRows((data ?? []) as AdminSubmission[])
    setRegistered(Number(countData ?? 0))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(
    () => filterAndSortResponses(rows, search, filter, sort),
    [rows, search, filter, sort],
  )
  const rankings = useMemo(
    () => ({
      sena: rankedByCategory(rows, 'sena'),
      tsubame: rankedByCategory(rows, 'tsubame'),
    }),
    [rows],
  )
  const stats = useMemo(
    () => getResponseStats(rows, registered),
    [rows, registered],
  )

  const openImage = async (path: string) => {
    const { data, error: signedError } = await supabase.storage
      .from('submission-images')
      .createSignedUrl(path, 300)
    if (signedError) return setError('画像を開けませんでした。')
    setImage({ url: data.signedUrl, name: baseName(path) })
  }

  const edit = (row: AdminSubmission) => {
    setEditing(row)
    setScore(row.review?.confirmed_score?.toString() ?? '')
    setStatus(row.review?.verification_status ?? 'pending')
    setNote(row.review?.admin_note ?? '')
  }

  const saveReview = async () => {
    if (!editing || !session) return
    if (!isValidConfirmedScore(score))
      return setError('評価値は0以上の整数で入力してください。')

    setSaving(true)
    const { error: saveError } = await supabase
      .from('submission_reviews')
      .upsert({
        submission_id: editing.id,
        confirmed_score: parseConfirmedScore(score),
        verification_status: status,
        admin_note: note.trim(),
        verified_at: status === 'verified' ? new Date().toISOString() : null,
        verified_by: status === 'verified' ? session.user.id : null,
      })
    setSaving(false)
    if (saveError) return setError('確認結果を保存できませんでした。')
    setEditing(null)
    await load()
  }

  const downloadCsv = () => {
    const header = [
      'ユーザーID',
      'サーバー内ユーザーネーム',
      'ゲーム内プロデューサーネーム',
      '育成キャラクター',
      '確認済み評価値',
      '確認状態',
      '管理者メモ',
      '初回回答日時',
      '最終更新日時',
    ]
    const lines = filtered.map((row) =>
      [
        row.profile.user_id,
        row.discord_username,
        row.producer_name,
        categoryName[row.category],
        row.review?.confirmed_score,
        statusName[row.review?.verification_status ?? 'pending'],
        row.review?.admin_note,
        row.created_at,
        row.updated_at,
      ]
        .map(csvCell)
        .join(','),
    )
    const blob = new Blob(
      [`\uFEFF${header.map(csvCell).join(',')}\r\n${lines.join('\r\n')}`],
      { type: 'text/csv;charset=utf-8' },
    )
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = `responses-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  return (
    <main className="page wide-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">RESULTS & VERIFICATION</p>
          <h1>回答結果</h1>
          <p>提出内容の確認、評価値の登録、集計を行います。</p>
        </div>
        <button className="button primary" onClick={downloadCsv}>
          CSV出力
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}
      <ResponseStats registered={registered} stats={stats} />
      <ResponseRankings rankings={rankings} />
      <ResponsesTable
        rows={filtered}
        verifiedCount={stats.verified}
        search={search}
        filter={filter}
        sort={sort}
        onSearchChange={setSearch}
        onFilterChange={setFilter}
        onSortChange={setSort}
        onOpenImage={(path) => void openImage(path)}
        onEdit={edit}
      />

      {editing && (
        <ReviewModal
          score={score}
          status={status}
          note={note}
          saving={saving}
          onScoreChange={setScore}
          onStatusChange={setStatus}
          onNoteChange={setNote}
          onSave={() => void saveReview()}
          onClose={() => setEditing(null)}
        />
      )}
      {image && <ImageModal image={image} onClose={() => setImage(null)} />}
    </main>
  )
}
