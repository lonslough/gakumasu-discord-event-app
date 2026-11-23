import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DivisionSettingsEditor } from './DivisionSettingsEditor'
import { normalizeDivisions } from '../../lib/divisions'
import type { DivisionSettings } from '../../types'

afterEach(cleanup)
const initial: DivisionSettings = {
  z: { name: '先頭', description: '', eligibility: '', requiresProof: false, order: 0 },
  a: { name: '次の部門', description: '', eligibility: '条件', requiresProof: true, order: 1 },
}
function Editor({ usage = {}, error = '', value = initial }: { usage?: Record<string, number> | null; error?: string; value?: DivisionSettings }) {
  const [state, setState] = useState(value)
  return <><DivisionSettingsEditor value={state} onChange={setState} usage={usage} usageError={error} /><output>{JSON.stringify(normalizeDivisions(state))}</output></>
}
describe('部門の構成編集', () => {
  it('JSONBのキー順ではなく保存済みの表示順に並べる', () => {
    render(<Editor value={{ a: initial.a, z: initial.z }} />)
    expect(screen.getByLabelText('部門1の名称')).toHaveValue('先頭')
    expect(screen.getByLabelText('部門2の名称')).toHaveValue('次の部門')
  })
  it('追加は空欄・証明オフ、10部門で追加を止める', () => {
    render(<Editor />)
    for (let i = 3; i <= 10; i++) fireEvent.click(screen.getByRole('button', { name: '部門を追加' }))
    expect(screen.getByLabelText('部門3の名称')).toHaveValue('')
    expect(screen.getByLabelText('部門3の証明画像を必須にする')).not.toBeChecked()
    expect(screen.getByRole('button', { name: '部門を追加' })).toBeDisabled()
    expect(screen.getByText('10/10部門')).toBeInTheDocument()
  })
  it('削除確認のキャンセルは入力を保持し、削除後は最低1部門を残す', () => {
    render(<Editor />)
    fireEvent.click(screen.getByLabelText('部門2を削除'))
    expect(screen.getByRole('dialog')).toHaveTextContent('次の部門')
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.getByLabelText('部門2の名称')).toHaveValue('次の部門')
    fireEvent.click(screen.getByLabelText('部門2を削除'))
    fireEvent.click(screen.getByRole('button', { name: '削除する' }))
    expect(screen.queryByLabelText('部門2の名称')).not.toBeInTheDocument()
    expect(screen.getByLabelText('部門1を削除')).toBeDisabled()
  })
  it('回答済みは削除と証明設定をロックするが文言を編集できる', () => {
    render(<Editor usage={{ z: 1 }} />)
    expect(screen.getByLabelText('部門1を削除')).toBeDisabled()
    expect(screen.getByLabelText('部門1の証明画像を必須にする')).toBeDisabled()
    expect(screen.getByLabelText('部門1の名称')).toBeEnabled()
    expect(screen.getByLabelText('部門1の参加条件文')).toBeEnabled()
    expect(screen.getByLabelText('部門2を削除')).toBeEnabled()
  })
  it.each(['', '取得に失敗'])('件数未取得/失敗中は保護を外さない: %s', error => {
    render(<Editor usage={null} error={error} />)
    expect(screen.getByLabelText('部門1を削除')).toBeDisabled()
    expect(screen.getByLabelText('部門2の証明画像を必須にする')).toBeDisabled()
  })
  it('参加条件と証明設定を新規部門にも保存データへ反映する', () => {
    render(<Editor />)
    fireEvent.click(screen.getByRole('button', { name: '部門を追加' }))
    fireEvent.change(screen.getByLabelText('部門3の参加条件文'), { target: { value: ' 新しい条件 ' } })
    fireEvent.click(screen.getByLabelText('部門3の証明画像を必須にする'))
    const values = Object.values(JSON.parse(screen.getByRole('status').textContent!) as DivisionSettings)
    expect(values[2]).toMatchObject({ eligibility: '新しい条件', requiresProof: true, order: 2 })
  })
})
