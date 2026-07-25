import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReviewModal,
  type ReviewImages,
} from '../components/responses/ResponseModals'
import { ResponseRankings } from '../components/responses/ResponseRankings'
import { ResponseStats } from '../components/responses/ResponseStats'
import { ResponsesTable } from '../components/responses/ResponsesTable'
import {
  categoryName,
  entryDivisionName,
  statusName,
} from '../components/responses/labels'
import { useAuth } from '../contexts/AuthContext'
import {
  csvCell,
  filterAndSortResponses,
  getResponseStats,
  hasResultImage,
  isValidConfirmedScore,
  parseConfirmedScore,
  type CategoryFilter,
  type ResponseSort,
  type StatusFilter,
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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<ResponseSort>('updated')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<AdminSubmission | null>(null)
  const [score, setScore] = useState('')
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const [note, setNote] = useState('')
  const [reviewImages, setReviewImages] = useState<ReviewImages>({})
  const [imagesLoading, setImagesLoading] = useState(false)
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
    () =>
      filterAndSortResponses(rows, search, categoryFilter, statusFilter, sort),
    [rows, search, categoryFilter, statusFilter, sort],
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

  const edit = async (row: AdminSubmission) => {
    setEditing(row)
    setScore(row.review?.confirmed_score?.toString() ?? '')
    setStatus(row.review?.verification_status ?? 'pending')
    setNote(row.review?.admin_note ?? '')
    setReviewImages({})
    setImagesLoading(true)

    const paths = {
      result: hasResultImage(row) ? row.score_image_path : null,
      beginnerProof: row.beginner_proof_image_path,
      loginDaysProof: row.login_days_proof_image_path,
    }
    const signedEntries = await Promise.all(
      Object.entries(paths).map(async ([key, path]) => {
        if (!path) return [key, undefined] as const
        const { data, error: signedError } = await supabase.storage
          .from('submission-images')
          .createSignedUrl(path, 300)
        if (signedError) {
          setError('一部の画像を開けませんでした。')
          return [key, undefined] as const
        }
        return [key, { url: data.signedUrl, name: baseName(path) }] as const
      }),
    )
    setReviewImages(Object.fromEntries(signedEntries) as ReviewImages)
    setImagesLoading(false)
  }

  const saveReview = async () => {
    if (!editing || !session) return
    const canEditVerification = hasResultImage(editing)
    if (canEditVerification && !isValidConfirmedScore(score))
      return setError('評価値は0以上の整数で入力してください。')

    const nextStatus = canEditVerification
      ? status
      : (editing.review?.verification_status ?? 'pending')
    setSaving(true)
    const { error: saveError } = await supabase
      .from('submission_reviews')
      .upsert({
        submission_id: editing.id,
        confirmed_score: canEditVerification
          ? parseConfirmedScore(score)
          : (editing.review?.confirmed_score ?? null),
        verification_status: nextStatus,
        admin_note: note.trim(),
        verified_at:
          nextStatus === 'verified'
            ? canEditVerification
              ? new Date().toISOString()
              : (editing.review?.verified_at ?? null)
            : null,
        verified_by:
          nextStatus === 'verified'
            ? canEditVerification
              ? session.user.id
              : (editing.review?.verified_by ?? null)
            : null,
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
      '応募部門',
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
        entryDivisionName[row.entry_division],
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
        categoryFilter={categoryFilter}
        statusFilter={statusFilter}
        sort={sort}
        onSearchChange={setSearch}
        onCategoryFilterChange={setCategoryFilter}
        onStatusFilterChange={setStatusFilter}
        onSortChange={setSort}
        onEdit={(row) => void edit(row)}
      />

      {editing && (
        <ReviewModal
          score={score}
          status={status}
          note={note}
          saving={saving}
          verificationDisabled={!hasResultImage(editing)}
          images={reviewImages}
          imagesLoading={imagesLoading}
          onScoreChange={setScore}
          onStatusChange={setStatus}
          onNoteChange={setNote}
          onSave={() => void saveReview()}
          onClose={() => {
            setEditing(null)
            setReviewImages({})
          }}
        />
      )}
    </main>
  )
}
