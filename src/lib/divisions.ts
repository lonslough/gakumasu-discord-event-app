import type { DivisionSettings, EntryDivision } from '../types'

export const divisionIds = (value?: DivisionSettings): EntryDivision[] => {
  const options = value ?? defaultDivisionSettings
  return Object.keys(options).sort((a, b) => (options[a].order ?? Infinity) - (options[b].order ?? Infinity))
}
export const defaultDivisionSettings: DivisionSettings = {
  open: { name: '無差別部門', description: '参加条件なし', eligibility: '', requiresProof: false, order: 0 },
  switch_off: { name: 'スイッチカードOFF部門', description: 'スイッチカードOFF必須', eligibility: '', requiresProof: false, order: 1 },
  beginner: { name: '初心者部門', description: 'スイッチカードOFF必須', eligibility: '参加条件：イベント参加時点で「PLv60未満」または「ログイン日数合計90日以下」の方', requiresProof: true, order: 2 },
}
export const copyDivisions = (value?: DivisionSettings) => structuredClone(value ?? defaultDivisionSettings)
export const newDivision = () => ({ name: '', description: '', eligibility: '', requiresProof: false })
export const emptyDivisions = (): DivisionSettings => ({ [crypto.randomUUID()]: newDivision() })
export const divisionLabel = (value: DivisionSettings | undefined, id: EntryDivision) =>
  (value ?? defaultDivisionSettings)[id]?.name ?? '不明な部門'
export const requiresDivisionProof = (value: DivisionSettings | undefined, id: string) =>
  Boolean((value ?? defaultDivisionSettings)[id]?.requiresProof)
export function normalizeDivisions(value: DivisionSettings): DivisionSettings {
  return Object.fromEntries(divisionIds(value).map((id, order) => [id, {
    name: value[id].name.trim(), description: value[id].description.trim(),
    eligibility: (value[id].eligibility ?? '').trim(), requiresProof: value[id].requiresProof, order,
  }])) as DivisionSettings
}
export function divisionError(value: DivisionSettings): string {
  const ids = divisionIds(value)
  if (ids.length < 1 || ids.length > 10) return '応募部門は1〜10部門にしてください。'
  const names = ids.map(id => value[id].name)
  if (names.some(name => !name)) return 'すべての部門名を入力してください。'
  if (names.some(name => Array.from(name).length > 50)) return '部門名は50文字以内で入力してください。'
  if (new Set(names).size !== names.length) return '同じ開催回で部門名を重複させることはできません。'
  if (ids.some(id => Array.from(value[id].description).length > 200)) return '補足文は200文字以内で入力してください。'
  if (ids.some(id => Array.from(value[id].eligibility ?? '').length > 500)) return '参加条件文は500文字以内で入力してください。'
  if (ids.some(id => typeof value[id].requiresProof !== 'boolean')) return '証明画像の必須設定を確認してください。'
  return ''
}
