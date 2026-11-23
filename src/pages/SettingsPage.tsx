import { DivisionSettingsEditor } from '../components/settings/DivisionSettingsEditor'
import { copyDivisions, emptyDivisions, normalizeDivisions, divisionError } from '../lib/divisions'
import type { DivisionSettings } from '../types'
import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { PageImageSettings, uploadPageImages, type PageImageFiles } from '../components/settings/PageImageSettings'
import { RulesEditorModal, maxRulesLength } from '../components/settings/RulesEditorModal'
import { cacheLocalPageImages, downloadPageImages } from '../lib/localPageImages'
import { useAuth } from '../contexts/AuthContext'
import { characterRoster, defaultCharacterOptions } from '../lib/characters'
import { supabase } from '../lib/supabase'
import type { CharacterOption, EventEdition } from '../types'

const newEventValue = '__new__'
const emptyCharacters = (): CharacterOption[] => [
  { id: '', name: '', shortName: '', enabled: true },
  { id: '', name: '', shortName: '', enabled: true },
]

const toLocalDateTime = (value: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function SettingsPage() {
  const { session } = useAuth()
  const [divisions, setDivisions] = useState<DivisionSettings>(emptyDivisions)
  const [usageResult, setUsageResult] = useState<{ eventId: string; counts: Record<string, number>; error: string } | null>(null)
  const [rules, setRules] = useState('')
  const [eventName, setEventName] = useState('')
  const [rankingPublished, setRankingPublished] = useState(false)
  const [submissionStart, setSubmissionStart] = useState('')
  const [submissionEnd, setSubmissionEnd] = useState('')
  const [characters, setCharacters] = useState<CharacterOption[]>([])
  const [events, setEvents] = useState<EventEdition[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  let usage: Record<string, number> | null = null
  if (selectedEventId === newEventValue) usage = {}
  else if (usageResult?.eventId === selectedEventId && !usageResult.error) usage = usageResult.counts
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [rulesDraft, setRulesDraft] = useState('')
  const [rulesSourceEventId, setRulesSourceEventId] = useState('')
  const [rulesSubmitting, setRulesSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pageImageFiles, setPageImageFiles] = useState<PageImageFiles>({ login: null, entry: null })

  const loadEvents = async (preferredId?: string) => {
    const { data, error: loadError } = await supabase
      .from('event_editions')
      .select('*')
      .order('created_at', { ascending: false })
    if (loadError) {
      setError('開催回を読み込めませんでした。')
      setLoading(false)
      return
    }
    const loaded = (data ?? []) as EventEdition[]
    setEvents(loaded)
    setSelectedEventId(preferredId ?? loaded.find((event) => event.is_active)?.id ?? loaded[0]?.id ?? newEventValue)
    setLoading(false)
  }

  useEffect(() => { void loadEvents() }, [])

  useEffect(() => {
    setPageImageFiles({ login: null, entry: null })
    if (selectedEventId === newEventValue) {
      setDivisions(events[0] ? copyDivisions(events[0].division_settings) : emptyDivisions())
      setRules('')
      setEventName('')
      setRankingPublished(false)
      setSubmissionStart('')
      setSubmissionEnd('')
      setCharacters(emptyCharacters())
      return
    }
    const selected = events.find((event) => event.id === selectedEventId)
    if (!selected) return
    setDivisions(copyDivisions(selected.division_settings))
    setRules(selected.rules_description)
    setEventName(selected.name)
    setRankingPublished(Boolean(selected.ranking_published))
    setSubmissionStart(toLocalDateTime(selected.submission_start_at))
    setSubmissionEnd(toLocalDateTime(selected.submission_end_at))
    setCharacters(selected.character_options.length === 2 ? selected.character_options : defaultCharacterOptions)
  }, [events, selectedEventId])

  useEffect(() => {
    if (!selectedEventId || selectedEventId === newEventValue) return
    let current = true
    void Promise.resolve(supabase.rpc('get_event_division_usage', { p_event_id: selectedEventId })).then(({ data, error }) => {
      if (current) setUsageResult({ eventId: selectedEventId, counts: data ?? {}, error: error ? '部門の回答件数を取得できませんでした。画面を開き直して再試行してください。' : '' })
    }).catch(() => {
      if (current) setUsageResult({ eventId: selectedEventId, counts: {}, error: '部門の回答件数を取得できませんでした。画面を開き直して再試行してください。' })
    })
    return () => { current = false }
  }, [selectedEventId, events])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!session || submitting || rules.length > maxRulesLength) return
    const normalizedDivisions = normalizeDivisions(divisions)
    const invalidDivisions = divisionError(normalizedDivisions)
    if (invalidDivisions) { setError(invalidDivisions); return }
    if (!eventName.trim()) {
      setError('開催回の名称を入力してください。')
      return
    }
    if (characters.length !== 2 || characters.some((character) => !character.id) || characters[0].id === characters[1].id) {
      setError('異なるキャラクターを2名選択してください。')
      return
    }
    if (
      submissionStart &&
      submissionEnd &&
      new Date(submissionStart) >= new Date(submissionEnd)
    ) {
      setError('応募終了日時は応募開始日時より後に設定してください。')
      return
    }
    const savedImagesPath = events.find((item) => item.id === selectedEventId)?.page_images_path ?? null
    if (!savedImagesPath && Boolean(pageImageFiles.login) !== Boolean(pageImageFiles.entry)) {
      setError('ページ画像はログインページ用と回答入力画面用の両方を選択してください。')
      return
    }
    setSubmitting(true)
    setMessage('')
    setError('')
    const values = {
      name: eventName.trim(),
      division_settings: normalizedDivisions,
      ranking_published: rankingPublished,
      rules_description: rules,
      submission_start_at: submissionStart ? new Date(submissionStart).toISOString() : null,
      submission_end_at: submissionEnd ? new Date(submissionEnd).toISOString() : null,
      character_options: characters,
      updated_by: session.user.id,
    }
    const creating = selectedEventId === newEventValue
    let savedEventId = selectedEventId
    if (creating) {
      const { data, error: createError } = await supabase.from('event_editions').insert(values).select('id').single()
      if (createError) {
        setError('新しい開催回の作成に失敗しました。')
        setSubmitting(false)
        return
      }
      savedEventId = data.id
    } else {
      const { error: updateError } = await supabase.from('event_editions').update(values).eq('id', selectedEventId)
      if (updateError) {
        setError('設定の保存に失敗しました。')
        setSubmitting(false)
        return
      }
    }
    if (pageImageFiles.login || pageImageFiles.entry) {
      try {
        await uploadPageImages(
          savedEventId,
          pageImageFiles,
          Boolean(events.find((item) => item.id === savedEventId)?.is_active),
          savedImagesPath,
        )
      } catch {
        await loadEvents(savedEventId)
        setError('開催回の設定は保存しましたが、ページ画像をStorageへ保存できませんでした。')
        setSubmitting(false)
        return
      }
    }
    await loadEvents(savedEventId)
    setMessage(creating ? '新しい開催回を作成しました。' : '設定を保存しました。')
    setSubmitting(false)
  }

  const saveRules = async () => {
    if (!session || rulesDraft.length > maxRulesLength) return
    setRulesSubmitting(true)
    setMessage('')
    setError('')
    if (selectedEventId === newEventValue) {
      setRules(rulesDraft)
      setRulesSubmitting(false)
      setShowRulesModal(false)
      return
    }
    const { error: updateError } = await supabase
      .from('event_editions')
      .update({ rules_description: rulesDraft, updated_by: session.user.id })
      .eq('id', selectedEventId)
    setRulesSubmitting(false)
    if (updateError) {
      setError('ルール説明の保存に失敗しました。')
      return
    }
    setRules(rulesDraft)
    setShowRulesModal(false)
    setMessage('ルール説明を保存しました。')
    await loadEvents(selectedEventId)
  }

  const activateEvent = async () => {
    const selected = events.find((event) => event.id === selectedEventId)
    if (!selected?.page_images_path) return setError('先にこの開催回のページ画像をStorageへ保存してください。')
    if (activating) return
    setActivating(true)
    setError('')
    setMessage('')
    try {
      let images: Awaited<ReturnType<typeof downloadPageImages>> | undefined
      if (import.meta.env.DEV) {
        try {
          images = await downloadPageImages(selected.page_images_path)
        } catch {
          setError('Storageからローカル確認用のページ画像を読み込めませんでした。')
          return
        }
      }
      const { error: activateError } = import.meta.env.DEV
        ? await supabase.rpc('set_active_event', { p_event_id: selectedEventId })
        : await supabase.functions.invoke('activate-event', { body: { eventId: selectedEventId } })
      if (activateError) throw activateError
      if (images) await cacheLocalPageImages(images.login, images.entry, selectedEventId)
      await loadEvents(selectedEventId)
      setMessage('回答受付対象の開催回を切り替えました。')
    } catch {
      setError('回答受付対象を切り替えられませんでした。')
    } finally {
      setActivating(false)
    }
  }

  return (
    <main className="page narrow">
      <div className="page-title">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>設定</h1>
          <p>イベントルール、対象キャラクター、応募部門、応募受付期間を設定します。</p>
        </div>
      </div>
      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      <section className="card rules-editor-card">
        {loading ? (
          <div className="spinner" />
        ) : (
          <form onSubmit={submit}><fieldset className="settings-form-fields" disabled={submitting}>
            <fieldset className="settings-section">
              <legend>開催回</legend>
              <div className="form-grid">
                <label>
                  編集する開催回
                  <select disabled={activating} value={selectedEventId} onChange={(event) => { setPageImageFiles({ login: null, entry: null }); setSelectedEventId(event.target.value); setMessage(''); setError('') }}>
                    {events.map((event) => <option value={event.id} key={event.id}>{event.name}{event.is_active ? '（回答受付対象）' : ''}</option>)}
                    <option value={newEventValue}>新規開催</option>
                  </select>
                </label>
                <label>
                  開催回の名称
                  <input value={eventName} maxLength={100} onChange={(event) => setEventName(event.target.value)} />
                </label>
              </div>
              <div className="event-settings-actions">
                <button type="button" className="button secondary small" disabled={activating || selectedEventId === newEventValue || events.find((event) => event.id === selectedEventId)?.is_active} onClick={() => void activateEvent()}>
                  この開催回を回答受付対象にする
                </button>
              </div>
              <label className="ranking-publication-toggle">
                <input type="checkbox" checked={rankingPublished} onChange={(event) => setRankingPublished(event.target.checked)} />
                ランキングを公開する
              </label>
              <small>ログインしたユーザーに、この開催回のランキングを公開します。「設定を保存」で反映されます。</small>
            </fieldset>
            <fieldset className="settings-section">
              <legend>応募期間</legend>
              <div className="form-grid">
                <label htmlFor="submission-start">
                  応募開始日時
                  <input
                    id="submission-start"
                    type="datetime-local"
                    value={submissionStart}
                    onChange={(event) => setSubmissionStart(event.target.value)}
                  />
                  <small>未設定の場合、開始日時による制限は行いません。</small>
                </label>
                <label htmlFor="submission-end">
                  応募終了日時
                  <input
                    id="submission-end"
                    type="datetime-local"
                    value={submissionEnd}
                    onChange={(event) => setSubmissionEnd(event.target.value)}
                  />
                  <small>終了後は新規回答と回答の更新を受け付けません。</small>
                </label>
              </div>
            </fieldset>
            <PageImageSettings
              key={`${selectedEventId}:${events.find((item) => item.id === selectedEventId)?.updated_at ?? ''}`}
              isActive={Boolean(events.find((event) => event.id === selectedEventId)?.is_active)}
              pageImagesPath={events.find((event) => event.id === selectedEventId)?.page_images_path ?? null}
              files={pageImageFiles}
              onFilesChange={setPageImageFiles}
            />
            <fieldset className="settings-section">
              <legend>対象キャラクター</legend>
              <div className="character-settings-list">
                {characters.map((character, index) => (
                  <Fragment key={index}>
                    <div className="character-slot">
                      <label htmlFor={`character-slot-${index}`}>
                        キャラクター {index + 1}
                        <select
                          id={`character-slot-${index}`}
                          value={character.id}
                          onChange={(event) => {
                            const selected = characterRoster.find((option) => option.id === event.target.value)
                            setCharacters((current) => current.map((item, itemIndex) => itemIndex === index ? (selected ?? emptyCharacters()[0]) : item))
                          }}
                        >
                          <option value="">未選択</option>
                          {characterRoster
                            .filter((option) => option.id === character.id || !characters.some((selected, selectedIndex) => selectedIndex !== index && selected.id === option.id))
                            .map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
                        </select>
                      </label>
                    </div>
                    {index === 0 && (
                      <button
                        type="button"
                        className="character-swap-button"
                        aria-label="2つのキャラクターを入れ替える"
                        title="入れ替える"
                        onClick={() => setCharacters(([first, second]) => [second, first])}
                      >
                        ⇄
                      </button>
                    )}
                  </Fragment>
                ))}
              </div>
                <label>
                <small>強化月間の2枠に割り当てるキャラクターを選択します。同じキャラクターは重複して選択できません。</small>
                </label>
            </fieldset>
<DivisionSettingsEditor key={selectedEventId} value={divisions} onChange={setDivisions} usage={usage} usageError={usageResult?.eventId === selectedEventId ? usageResult.error : ''} />
            <div className="settings-section rules-setting-row">
              <div>
                <strong>ルール説明</strong>
                <small>回答入力画面に表示するイベントルールを編集します。</small>
              </div>
              <button type="button" className="button secondary" onClick={() => { setRulesDraft(rules); setRulesSourceEventId(''); setShowRulesModal(true) }}>
                ルール説明変更
              </button>
            </div>
            <div className="rules-editor-footer">
              <button className="button primary" disabled={submitting}>
                {submitting ? '保存中…' : '設定を保存'}
              </button>
            </div>
          </fieldset></form>
        )}
      </section>
      {showRulesModal && (
        <RulesEditorModal
          events={events}
          selectedEventId={selectedEventId}
          sourceEventId={rulesSourceEventId}
          value={rulesDraft}
          submitting={rulesSubmitting}
          onSourceEventChange={setRulesSourceEventId}
          onChange={setRulesDraft}
          onSave={() => void saveRules()}
          onClose={() => !rulesSubmitting && setShowRulesModal(false)}
        />
      )}
    </main>
  )
}
