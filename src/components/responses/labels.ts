import type { Category, EntryDivision, VerificationStatus } from '../../types'

export const categoryName: Record<Category, string> = {
  sena: '十王星南',
  tsubame: '雨夜燕',
}

export const statusName: Record<VerificationStatus, string> = {
  pending: '未確認',
  verified: '確認済み',
  invalid: '無効',
}

export const entryDivisionName: Record<EntryDivision, string> = {
  open: '無差別部門',
  switch_off: 'スイッチカードOFF部門',
  beginner: '初心者部門',
}
