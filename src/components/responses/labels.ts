import type { Category, VerificationStatus } from '../../types'

export const categoryName: Record<Category, string> = {
  sena: '十王星南',
  tsubame: '雨夜燕',
}

export const statusName: Record<VerificationStatus, string> = {
  pending: '未確認',
  verified: '確認済み',
  invalid: '無効',
}
