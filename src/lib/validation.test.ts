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
  it.each([
    'ab',
    'a'.repeat(33),
    'user@example',
    '日本語',
    '.user',
    'user.',
    'user..name',
  ])('不正な値 %s を拒否する', (value) =>
    expect(validateUserId(value)).not.toBeNull(),
  )
  it.each(['abc', 'example-user', 'user_123', 'user.name'])(
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
          entryDivision: '',
          resultFile: null,
          beginnerProofFile: null,
          loginDaysProofFile: null,
        }),
      ),
    ).toHaveLength(4))
  it('評価値・最終所持スキルカード画像は未添付でも送信できる', () =>
    expect(
      validateEntry({
        discordUsername: 'discord',
        producerName: 'producer',
        category: 'sena',
        entryDivision: 'open',
        resultFile: null,
        beginnerProofFile: null,
        loginDaysProofFile: null,
      }),
    ).toEqual({}))
  it('初心者部門ではPIDとPレベル画像を必須にする', () =>
    expect(
      validateEntry(
        {
          discordUsername: 'discord',
          producerName: 'producer',
          category: 'sena',
          entryDivision: 'beginner',
          resultFile: null,
          beginnerProofFile: null,
          loginDaysProofFile: null,
        },
        { beginnerProof: false, loginDaysProof: true },
      ),
    ).toHaveProperty('beginnerProofFile'))
  it('初心者部門以外ではPIDとPレベル画像を要求しない', () =>
    expect(
      validateEntry(
        {
          discordUsername: 'discord',
          producerName: 'producer',
          category: 'sena',
          entryDivision: 'switch_off',
          resultFile: null,
          beginnerProofFile: null,
          loginDaysProofFile: null,
        },
        { beginnerProof: false, loginDaysProof: false },
      ),
    ).toEqual({}))
  it('初心者部門では総出席日数画像を必須にする', () =>
    expect(
      validateEntry(
        {
          discordUsername: 'discord',
          producerName: 'producer',
          category: 'sena',
          entryDivision: 'beginner',
          resultFile: null,
          beginnerProofFile: null,
          loginDaysProofFile: null,
        },
        { beginnerProof: true, loginDaysProof: false },
      ),
    ).toHaveProperty('loginDaysProofFile'))
})
