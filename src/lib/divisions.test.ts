import { describe, expect, it } from 'vitest'
import { copyDivisions, defaultDivisionSettings, divisionError, divisionIds, emptyDivisions, normalizeDivisions } from './divisions'
import { validateEntry } from './validation'
import { createInitialEntryValues } from './entryService'

describe('部門設定の保存境界', () => {
  it('カスタム部門の所属と証明必須を検証する', () => {
    const values = { ...createInitialEntryValues(), discordUsername: '参加者', producerName: 'P', category: 'sena', entryDivision: 'custom' }
    const options = { custom: { name: '証明枠', description: '', requiresProof: true } }
    expect(validateEntry(values, undefined, options)).toMatchObject({ beginnerProofFile: expect.any(String), loginDaysProofFile: expect.any(String) })
    expect(validateEntry(values, { beginnerProof: true, loginDaysProof: true }, options)).toEqual({})
    expect(validateEntry(values, undefined, { custom: { ...options.custom, requiresProof: false } })).toEqual({})
    expect(validateEntry({ ...values, entryDivision: 'deleted' }, undefined, options)).toHaveProperty('entryDivision')
  })
  it('1部門から開始し初期値は空欄・証明オフ', () => {
    const values = Object.values(emptyDivisions())
    expect(values).toHaveLength(1)
    expect(values[0]).toMatchObject({ name: '', requiresProof: false })
  })
  it('コピー後の編集で元の開催回を変更しない', () => {
    const clone = copyDivisions()
    clone.open.name = '別の回'
    expect(defaultDivisionSettings.open.name).toBe('無差別部門')
  })
  it('trimして文中改行を残し削除後の表示順を連番へ直す', () => {
    const next = normalizeDivisions({ later: { name: '　部門　', description: ' 前\n後 ', eligibility: ' 条件 ', requiresProof: false, order: 9 } })
    expect(next.later).toMatchObject({ name: '部門', description: '前\n後', eligibility: '条件', order: 0 })
  })
  it('Unicodeの50/200/500文字ちょうどを許可する', () => {
    const value = { custom: { name: '😀'.repeat(50), description: 'あ'.repeat(200), eligibility: 'い'.repeat(500), requiresProof: false } }
    expect(divisionError(value)).toBe('')
    expect(divisionError({ custom: { ...value.custom, name: '😀'.repeat(51) } })).toContain('50文字')
    expect(divisionError({ custom: { ...value.custom, description: 'あ'.repeat(201) } })).toContain('200文字')
    expect(divisionError({ custom: { ...value.custom, eligibility: 'い'.repeat(501) } })).toContain('500文字')
  })
  it('0部門・11部門・名称空白・trim後重複を拒否する', () => {
    expect(divisionError({})).toContain('1〜10')
    expect(divisionError(Object.fromEntries(Array.from({ length: 11 }, (_, i) => [String(i), { name: String(i), description: '', requiresProof: false }])))).toContain('1〜10')
    const empty = normalizeDivisions({ x: { name: '　', description: '', requiresProof: false } })
    expect(divisionError(empty)).toContain('すべての部門名')
    const duplicate = normalizeDivisions({ x: { name: 'A ', description: '', requiresProof: false }, y: { name: ' A', description: '', requiresProof: false } })
    expect(divisionError(duplicate)).toContain('重複')
  })
  it('保存済み順序を優先して新規部門を末尾に追加する', () => {
    const value = { b: { ...defaultDivisionSettings.open, order: 1 }, a: { ...defaultDivisionSettings.open, order: 0 }, c: { name: '', description: '', requiresProof: false } }
    expect(divisionIds(value)).toEqual(['a', 'b', 'c'])
  })
})
