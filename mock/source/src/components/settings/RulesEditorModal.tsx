import { Modal } from '../Modal'
import type { EventEdition } from '../../types'

export const maxRulesLength = 10_000

interface RulesEditorModalProps {
  events: EventEdition[]
  selectedEventId: string
  sourceEventId: string
  value: string
  submitting: boolean
  onSourceEventChange: (eventId: string) => void
  onChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}

export function RulesEditorModal({
  events,
  selectedEventId,
  sourceEventId,
  value,
  submitting,
  onSourceEventChange,
  onChange,
  onSave,
  onClose,
}: RulesEditorModalProps) {
  const selectSource = (eventId: string) => {
    onSourceEventChange(eventId)
    const source = events.find((event) => event.id === eventId)
    if (source) onChange(source.rules_description)
  }

  return (
    <Modal
      title="ルール説明変更"
      wide
      onClose={onClose}
      actions={
        <>
          <button type="button" className="button secondary" disabled={submitting} onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className="button primary" disabled={submitting} onClick={onSave}>
            {submitting ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      <label className="rules-source-select" htmlFor="rules-source-event">
        過去の開催回から呼び出す
        <select
          id="rules-source-event"
          value={sourceEventId}
          onChange={(event) => selectSource(event.target.value)}
        >
          <option value="">選択してください</option>
          {events
            .filter((event) => event.id !== selectedEventId)
            .map((event) => <option value={event.id} key={event.id}>{event.name}</option>)}
        </select>
      </label>
      <label htmlFor="rules-description">
        ルール説明
        <textarea
          id="rules-description"
          className="rules-textarea"
          value={value}
          maxLength={maxRulesLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder="イベントのルールを入力してください。改行もそのまま回答入力画面に反映されます。"
        />
      </label>
      <div className="rules-character-count muted">
        {value.length.toLocaleString()} / {maxRulesLength.toLocaleString()}文字
      </div>
    </Modal>
  )
}
