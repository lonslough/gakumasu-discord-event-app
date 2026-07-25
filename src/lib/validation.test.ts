import { describe, expect, it } from 'vitest'
import {
  MAX_FILE_SIZE,
  normalizeUserId,
  validateEntry,
  validateImageFile,
  validateUserId,
} from './validation'

const file = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type })

describe('ユーザーID', () => {
  it('前後空白を除去し小文字化する', () =>
    expect(normalizeUserId('  Example_User-1 ')).toBe('example_user-1'))
  it.each(['ab', 'a'.repeat(33), 'user@example', '日本語'])(
    '不正な値 %s を拒否する',
    (value) => expect(validateUserId(value)).not.toBeNull(),
  )
  it.each(['abc', 'example-user', 'user_123'])(
    '正しい値 %s を許可する',
    (value) => expect(validateUserId(value)).toBeNull(),
  )
})

describe('画像検証', () => {
  it('対応する拡張子とMIMEを許可する', () =>
    expect(validateImageFile(file('score.JPG', 'image/jpeg'))).toBeNull())
  it('拡張子を検証する', () =>
    expect(validateImageFile(file('score.gif', 'image/jpeg'))).toContain(
      '形式',
    ))
  it('MIMEタイプを検証する', () =>
    expect(validateImageFile(file('score.jpg', 'text/plain'))).toContain(
      '種類',
    ))
  it('10MB超を拒否する', () =>
    expect(
      validateImageFile(file('score.png', 'image/png', MAX_FILE_SIZE + 1)),
    ).toContain('10MB'))
})

describe('応募フォーム', () => {
  it('必須項目を検証する', () =>
    expect(
      Object.keys(
        validateEntry({
          discordUsername: '',
          producerName: '',
          category: '',
          scoreFile: null,
          deckFile: null,
        }),
      ),
    ).toHaveLength(5))
  it('既存画像を維持できる', () =>
    expect(
      validateEntry(
        {
          discordUsername: 'discord',
          producerName: 'producer',
          category: 'sena',
          scoreFile: null,
          deckFile: null,
        },
        true,
      ),
    ).toEqual({}))
})
