import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { characterRoster, defaultCharacterOptions } from '../lib/characters'
import { supabase } from '../lib/supabase'
import type { CharacterOption, EventEdition } from '../types'

const maxRulesLength = 10000
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
  const [rules, setRules] = useState('')
  const [eventName, setEventName] = useState('')
  const [submissionStart, setSubmissionStart] = useState('')
  const [submissionEnd, setSubmissionEnd] = useState('')
  const [characters, setCharacters] = useState<CharacterOption[]>([])
  const [events, setEvents] = useState<EventEdition[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [showRulesModal, setShowRulesModal] = useState(false)
  const [rulesDraft, setRulesDraft] = useState('')
  const [rulesSourceEventId, setRulesSourceEventId] = useState('')
  const [rulesSubmitting, setRulesSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
    if (selectedEventId === newEventValue) {
      setRules('')
      setEventName('')
      setSubmissionStart('')
      setSubmissionEnd('')
      setCharacters(emptyCharacters())
      setMessage('')
      setError('')
      return
    }
    const selected = events.find((event) => event.id === selectedEventId)
    if (!selected) return
    setRules(selected.rules_description)
    setEventName(selected.name)
    setSubmissionStart(toLocalDateTime(selected.submission_start_at))
    setSubmissionEnd(toLocalDateTime(selected.submission_end_at))
    setCharacters(selected.character_options.length === 2 ? selected.character_options : defaultCharacterOptions)
    setMessage('')
    setError('')
  }, [events, selectedEventId])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!session || rules.length > maxRulesLength) return
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
    setSubmitting(true)
    setMessage('')
    setError('')
    const values = {
      name: eventName.trim(),
      rules_description: rules,
      submission_start_at: submissionStart ? new Date(submissionStart).toISOString() : null,
      submission_end_at: submissionEnd ? new Date(submissionEnd).toISOString() : null,
      character_options: characters,
      updated_by: session.user.id,
    }
    if (selectedEventId === newEventValue) {
      const { data, error: createError } = await supabase.from('event_editions').insert(values).select('id').single()
      if (createError) setError('新しい開催回の作成に失敗しました。')
      else {
        await loadEvents(data.id)
        setMessage('新しい開催回を作成しました。')
      }
    } else {
      const { error: updateError } = await supabase.from('event_editions').update(values).eq('id', selectedEventId)
      if (updateError) setError('設定の保存に失敗しました。')
      else {
        await loadEvents(selectedEventId)
        setMessage('設定を保存しました。')
      }
    }
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
    const { error: activateError } = await supabase.rpc('set_active_event', { p_event_id: selectedEventId })
    if (activateError) return setError('回答受付対象を切り替えられませんでした。')
    await loadEvents(selectedEventId)
    setMessage('回答受付対象の開催回を切り替えました。')
  }

  return (
    <main className="page narrow">
      <div className="page-title">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>設定</h1>
          <p>イベントルール、対象キャラクター、応募受付期間を設定します。</p>
        </div>
      </div>
      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      <section className="card rules-editor-card">
        {loading ? (
          <div className="spinner" />
        ) : (
          <form onSubmit={submit}>
            <fieldset className="settings-section">
              <legend>開催回</legend>
              <div className="form-grid">
                <label>
                  編集する開催回
                  <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)}>
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
                <button type="button" className="button secondary small" disabled={selectedEventId === newEventValue || events.find((event) => event.id === selectedEventId)?.is_active} onClick={() => void activateEvent()}>
                  この開催回を回答受付対象にする
                </button>
              </div>
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
          </form>
        )}
      </section>
      {showRulesModal && (
        <Modal
          title="ルール説明変更"
          wide
          onClose={() => !rulesSubmitting && setShowRulesModal(false)}
          actions={<><button type="button" className="button secondary" disabled={rulesSubmitting} onClick={() => setShowRulesModal(false)}>キャンセル</button><button type="button" className="button primary" disabled={rulesSubmitting} onClick={() => void saveRules()}>{rulesSubmitting ? '保存中…' : '保存'}</button></>}
        >
          <label className="rules-source-select" htmlFor="rules-source-event">
            過去の開催回から呼び出す
            <select
              id="rules-source-event"
              value={rulesSourceEventId}
              onChange={(event) => {
                const sourceEventId = event.target.value
                setRulesSourceEventId(sourceEventId)
                const sourceEvent = events.find((item) => item.id === sourceEventId)
                if (sourceEvent) setRulesDraft(sourceEvent.rules_description)
              }}
            >
              <option value="">選択してください</option>
              {events
                .filter((event) => event.id !== selectedEventId)
                .map((event) => <option value={event.id} key={event.id}>{event.name}</option>)}
            </select>
          </label>
          <label htmlFor="rules-description">
            ルール説明
            <textarea id="rules-description" className="rules-textarea" value={rulesDraft} maxLength={maxRulesLength} onChange={(event) => setRulesDraft(event.target.value)} placeholder="イベントのルールを入力してください。改行もそのまま回答入力画面に反映されます。" />
          </label>
          <div className="rules-character-count muted">{rulesDraft.length.toLocaleString()} / {maxRulesLength.toLocaleString()}文字</div>
        </Modal>
      )}
    </main>
  )
}
