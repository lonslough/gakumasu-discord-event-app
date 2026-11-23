import { useState } from 'react'
import { divisionIds, newDivision } from '../../lib/divisions'
import type { DivisionSettings } from '../../types'
import { Modal } from '../Modal'

export function DivisionSettingsEditor({ value, onChange, usage, usageError }: {
  value: DivisionSettings; onChange: (value: DivisionSettings) => void
  usage: Record<string, number> | null; usageError: string
}) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const ids = divisionIds(value)
  const deleteBlocked = (id: string) => usage === null || (usage[id] ?? 0) > 0 || ids.length <= 1
  return <fieldset className="settings-section division-settings">
    <legend>応募部門</legend>
    <p className="help">この開催回の部門を追加・削除し、案内文と証明画像の提出条件を編集します。「設定を保存」で反映されます。</p>
    <div className="division-settings-toolbar"><strong>{ids.length}/10部門</strong>
      <button type="button" className="button secondary small" disabled={ids.length >= 10} onClick={() => onChange({ ...value, [crypto.randomUUID()]: newDivision() })}>部門を追加</button>
    </div>
    {usageError && <p className="field-error" role="alert">{usageError}</p>}
    {usage === null && !usageError && <p className="help" role="status">部門の回答件数を確認中です。</p>}
    {ids.map((id, index) => {
      const option = value[id]
      const update = (key: string, text: string | boolean) => onChange({ ...value, [id]: { ...option, [key]: text } })
      const answered = (usage?.[id] ?? 0) > 0
      return <section className="division-settings-item" key={id} data-division-id={id}>
        <div className="division-settings-toolbar"><h3>部門 {index + 1}</h3>
          <button type="button" className="button secondary small" aria-label={`部門${index + 1}を削除`} disabled={deleteBlocked(id)} onClick={() => setDeleting(id)}>削除</button>
        </div>
        {answered ? <p className="help">回答が{usage?.[id]}件あります。部門の削除と証明画像の必須設定は変更できません。</p> : ids.length === 1 && <p className="help">応募部門は最低1部門必要です。</p>}
        <label>部門名 <span className="required">必須</span>
          <input aria-label={`部門${index + 1}の名称`} value={option.name} onChange={event => update('name', event.target.value)} />
          <small>{Array.from(option.name.trim()).length}/50文字・同じ開催回で重複不可</small>
        </label>
        <label>補足文 <small>任意</small>
          <textarea aria-label={`部門${index + 1}の補足文`} rows={2} value={option.description} onChange={event => update('description', event.target.value)} />
          <small>{Array.from(option.description.trim()).length}/200文字・空欄の場合は表示しません。</small>
        </label>
        <label>参加条件文 <small>任意</small>
          <textarea aria-label={`部門${index + 1}の参加条件文`} rows={3} value={option.eligibility ?? ''} onChange={event => update('eligibility', event.target.value)} />
          <small>{Array.from((option.eligibility ?? '').trim()).length}/500文字・空欄の場合は表示しません。</small>
        </label>
        <label className="division-proof-toggle">
          <input type="checkbox" aria-label={`部門${index + 1}の証明画像を必須にする`} checked={option.requiresProof} disabled={usage === null || answered} onChange={event => update('requiresProof', event.target.checked)} />
          証明画像2点を必須にする
        </label>
        <small>オンにすると「PID・Pレベル」と「総出席日数」の確認画像が必要です。</small>
      </section>
    })}
    {deleting && value[deleting] && <Modal title="応募部門を削除" onClose={() => setDeleting(null)} actions={<>
      <button type="button" className="button secondary" onClick={() => setDeleting(null)}>キャンセル</button>
      <button type="button" className="button primary" disabled={deleteBlocked(deleting)} onClick={() => {
        if (deleteBlocked(deleting)) return
        const next = { ...value }; delete next[deleting]; onChange(next); setDeleting(null)
      }}>削除する</button>
    </>}><p>「{value[deleting].name || '名称未入力の部門'}」を編集欄から削除しますか？</p><p>「設定を保存」で削除が確定します。</p></Modal>}
  </fieldset>
}
