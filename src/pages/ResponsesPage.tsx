import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReviewModal,
} from '../components/responses/ResponseModals'
import { ResponseRankings } from '../components/responses/ResponseRankings'
import { ResponseStats } from '../components/responses/ResponseStats'
import { ResponsesTable } from '../components/responses/ResponsesTable'
import { entryDivisionName, statusName } from '../components/responses/labels'
import { useAuth } from '../contexts/AuthContext'
import { useReviewImages } from '../hooks/useReviewImages'
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
import { rankedByCategoryAndDivision } from '../lib/ranking'
import { characterLabel, defaultCharacterOptions } from '../lib/characters'
import { supabase } from '../lib/supabase'
import type {
  AdminSubmission,
  Category,
  CharacterOption,
  EntryDivision,
  EventEdition,
  VerificationStatus,
} from '../types'

const rankingDivisions: EntryDivision[] = ['open', 'switch_off', 'beginner']

export function ResponsesPage() {
  const { session } = useAuth()
  const [rows, setRows] = useState<AdminSubmission[]>([])
  const [registered, setRegistered] = useState(0)
  const [characters, setCharacters] = useState<CharacterOption[]>(defaultCharacterOptions)
  const [events, setEvents] = useState<EventEdition[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<ResponseSort>('updated')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<AdminSubmission | null>(null)
  const [score, setScore] = useState('')
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const reviewImages = useReviewImages(setError)

  const load = useCallback(async () => {
    if (!selectedEventId) return
    setError('')
    const [{ data, error: rowsError }, { data: countData }] = await Promise.all(
      [
        supabase.rpc('list_admin_submissions', { p_event_id: selectedEventId }),
        supabase.rpc('count_registered_users'),
      ],
    )
    if (rowsError) setError('回答一覧を読み込めませんでした。')
    else setRows((data ?? []) as AdminSubmission[])
    setRegistered(Number(countData ?? 0))
    const selected = events.find((event) => event.id === selectedEventId)
    if (selected) setCharacters(selected.character_options)
  }, [events, selectedEventId])

  useEffect(() => {
    const loadEvents = async () => {
      const { data, error: eventsError } = await supabase.from('event_editions').select('*').order('created_at', { ascending: false })
      if (eventsError) return setError('開催回を読み込めませんでした。')
      const loaded = (data ?? []) as EventEdition[]
      setEvents(loaded)
      setSelectedEventId(loaded.find((event) => event.is_active)?.id ?? loaded[0]?.id ?? '')
    }
    void loadEvents()
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
    () =>
      Object.fromEntries(
        characters.map((character) => [
          character.id,
          Object.fromEntries(
            rankingDivisions.map((division) => [
              division,
              rankedByCategoryAndDivision(rows, character.id, division),
            ]),
          ) as Record<EntryDivision, AdminSubmission[]>,
        ]),
      ) as Record<Category, Record<EntryDivision, AdminSubmission[]>>,
    [rows, characters],
  )
  const stats = useMemo(
    () => getResponseStats(rows, registered, characters.map((character) => character.id)),
    [rows, registered, characters],
  )

  const edit = async (row: AdminSubmission) => {
    setEditing(row)
    setScore(row.review?.confirmed_score?.toString() ?? '')
    setStatus(row.review?.verification_status ?? 'pending')
    setNote(row.review?.admin_note ?? '')
    const current = await reviewImages.load(row)
    if (current) setEditing(current)
  }

  const saveReview = async () => {
    if (!editing || !session) return
    const canEditVerification = hasResultImage(editing)
    if (canEditVerification && !isValidConfirmedScore(score))
      return setError('評価値は0以上の整数で入力してください。')

    const nextStatus = canEditVerification
      ? status
      : (editing.review?.verification_status ?? 'pending')
    let verifiedAt: string | null = null
    let verifiedBy: string | null = null
    if (nextStatus === 'verified') {
      verifiedAt = canEditVerification
        ? new Date().toISOString()
        : (editing.review?.verified_at ?? null)
      verifiedBy = canEditVerification
        ? session.user.id
        : (editing.review?.verified_by ?? null)
    }
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
        verified_at: verifiedAt,
        verified_by: verifiedBy,
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
        characterLabel(characters, row.category),
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

      <section className="card event-history-selector">
        <label>表示する開催回<select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>{events.map((event) => <option value={event.id} key={event.id}>{event.name}{event.is_active ? '（開催中）' : ''}</option>)}</select></label>
      </section>

      {error && <div className="notice error">{error}</div>}
      <ResponseStats registered={registered} stats={stats} characters={characters} />
      <ResponseRankings rankings={rankings} characters={characters} />
      <ResponsesTable
        rows={filtered}
        characters={characters}
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
          images={reviewImages.images}
          imagesLoading={reviewImages.loading}
          onScoreChange={setScore}
          onStatusChange={setStatus}
          onNoteChange={setNote}
          onSave={() => void saveReview()}
          onClose={() => {
            reviewImages.clear()
            setEditing(null)
          }}
        />
      )}
    </main>
  )
}
