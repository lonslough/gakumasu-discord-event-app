import type { Category } from '../types'

export const MAX_FILE_SIZE = 10 * 1024 * 1024
const extensions = new Set(['jpg', 'jpeg', 'png', 'heic', 'heif'])
const mimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
])

export function normalizeUserId(value: string): string {
  return value.trim().toLowerCase()
}

export function validateUserId(value: string): string | null {
  const normalized = normalizeUserId(value)
  if (normalized.length < 3 || normalized.length > 32)
    return 'ユーザーIDは3文字以上32文字以下で入力してください。'
  if (!/^[a-z0-9_-]+$/.test(normalized))
    return 'ユーザーIDには半角英数字、ハイフン、アンダースコアのみ使用できます。'
  return null
}

export function internalEmail(userId: string): string {
  return `${normalizeUserId(userId)}@app.invalid`
}

export function fileExtension(name: string): string {
  return name.includes('.') ? (name.split('.').pop()?.toLowerCase() ?? '') : ''
}

export function validateImageFile(file: File): string | null {
  if (!extensions.has(fileExtension(file.name))) return 'jpg、jpeg、png、heic、heif形式を選択してください。'
  if (!mimeTypes.has(file.type.toLowerCase())) return '画像の種類を確認できません。対応する画像ファイルを選択してください。'
  if (file.size > MAX_FILE_SIZE) return 'ファイルサイズは10MB以下にしてください。'
  return null
}

export interface EntryValues {
  discordUsername: string
  producerName: string
  category: Category | ''
  scoreFile: File | null
  deckFile: File | null
}

export function validateEntry(values: EntryValues, hasExistingImages = false): Record<string, string> {
  const errors: Record<string, string> = {}
  const discordLength = values.discordUsername.trim().length
  const producerLength = values.producerName.trim().length
  if (discordLength < 1 || discordLength > 100) errors.discordUsername = '1文字以上100文字以下で入力してください。'
  if (producerLength < 1 || producerLength > 100) errors.producerName = '1文字以上100文字以下で入力してください。'
  if (!values.category) errors.category = '応募部門を選択してください。'
  if (!values.scoreFile && !hasExistingImages) errors.scoreFile = '評価値画像を選択してください。'
  if (!values.deckFile && !hasExistingImages) errors.deckFile = '最終デッキ画像を選択してください。'
  if (values.scoreFile) {
    const error = validateImageFile(values.scoreFile)
    if (error) errors.scoreFile = error
  }
  if (values.deckFile) {
    const error = validateImageFile(values.deckFile)
    if (error) errors.deckFile = error
  }
  return errors
}
