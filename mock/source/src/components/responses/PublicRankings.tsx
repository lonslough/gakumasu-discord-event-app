import { useEffect, useMemo, useState } from 'react'
import { getMockRankingScenario, setMockRankingScenario, supabase, type MockRankingScenario } from '../../lib/supabase'
import type { Category, EntryDivision, PublicRankingEntry, PublicRankingEvent } from '../../types'
import { ResponseRankings, type RankingDisplayRow } from './ResponseRankings'

const divisions: EntryDivision[] = ['open', 'switch_off', 'beginner']

// Review controls belong only to the independent, non-persistent mock.
export function PublicRankings() {
  const [scenario, setScenario] = useState(getMockRankingScenario)
  return <>
    <PublicRankingsView key={scenario} />
    <details className="page mock-ranking-controls">
      <summary>モック確認用：ランキングの取得状態</summary>
      <label>取得シナリオ
        <select value={scenario} onChange={(event) => {
          const value = event.target.value as MockRankingScenario
          setMockRankingScenario(value)
          setScenario(value)
        }}>
          <option value="normal">通常（保存した公開設定を使用）</option>
          <option value="events-error">開催回の取得失敗</option>
          <option value="ranking-error">ランキングの取得失敗（公開回が必要）</option>
          <option value="loading">開催回の読込中</option>
        </select>
      </label>
      <p>通信・保存・権限はメモリー内の模擬動作です。全回非公開で開始します。adminの設定で公開してから一般ユーザーで確認してください。</p>
    </details>
  </>
}

function PublicRankingsView() {
  const [events, setEvents] = useState<PublicRankingEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventError, setEventError] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [result, setResult] = useState<{ eventId: string; rows: PublicRankingEntry[]; error: string } | null>(null)
  const selected = events.find((event) => event.id === selectedEventId)

  useEffect(() => {
    let current = true
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('list_public_ranking_events')
        if (!current) return
        if (error) {
          setEventError('開催回を読み込めませんでした。')
          return
        }
        const loaded = (data ?? []) as PublicRankingEvent[]
        setEvents(loaded)
        setSelectedEventId(loaded.find((event) => event.is_active)?.id ?? loaded[0]?.id ?? '')
      } catch {
        if (current) setEventError('開催回を読み込めませんでした。')
      } finally {
        if (current) setEventsLoading(false)
      }
    }
    void load()
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (!selectedEventId) return
    let current = true
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_rankings', { p_event_id: selectedEventId })
        if (current) setResult({ eventId: selectedEventId, rows: error ? [] : (data ?? []) as PublicRankingEntry[], error: error ? 'ランキングを読み込めませんでした。' : '' })
      } catch {
        if (current) setResult({ eventId: selectedEventId, rows: [], error: 'ランキングを読み込めませんでした。' })
      }
    }
    void load()
    return () => { current = false }
  }, [selectedEventId])

  const rankings = useMemo(() => Object.fromEntries(
    (selected?.character_options ?? []).map((character) => [character.id, Object.fromEntries(
      divisions.map((division) => [division, (result?.eventId === selectedEventId ? result.rows : [])
        .filter((row) => row.category === character.id && row.entry_division === division)
        .sort((a, b) => a.rank - b.rank)
        .map((row) => ({ id: `${row.category}:${row.entry_division}:${row.rank}`, discord_username: row.discord_username, producer_name: row.producer_name, review: { confirmed_score: row.confirmed_score } })),
      ]),
    )]),
  ) as Record<Category, Record<EntryDivision, RankingDisplayRow[]>>, [selected, selectedEventId, result])

  const rankingLoading = Boolean(selected && result?.eventId !== selectedEventId)
  return <main className="page wide-page">
    <div className="page-title"><div><p className="eyebrow">RANKINGS</p><h1>ランキング</h1></div></div>
    {eventsLoading && <div className="spinner" aria-label="開催回を読み込み中" />}
    {eventError && <div className="notice error" role="alert">{eventError}</div>}
    {!eventsLoading && !eventError && !events.length && <section className="card"><p className="empty">ランキングは公開準備中です。</p></section>}
    {selected && <>
      <section className="card event-history-selector">
        <label>表示する開催回<select value={selectedEventId} onChange={(event) => { setResult(null); setSelectedEventId(event.target.value) }}>{events.map((event) => <option value={event.id} key={event.id}>{event.name}{event.is_active ? '（開催中）' : ''}</option>)}</select></label>
      </section>
      {rankingLoading && <div className="spinner" aria-label="ランキングを読み込み中" />}
      {!rankingLoading && result?.error && <div className="notice error" role="alert">{result.error}</div>}
      {!rankingLoading && result && !result.error && <ResponseRankings key={selectedEventId} rankings={rankings} characters={selected.character_options} />}
    </>}
  </main>
}
