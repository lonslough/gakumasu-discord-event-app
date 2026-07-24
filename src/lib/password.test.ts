import { describe, expect, it } from 'vitest'
import { generateSecurePassword } from './password'

describe('パスワード生成', () => {
  it('12文字で大文字・小文字・数字を含む', () => {
    for (let index = 0; index < 50; index++) {
      const value = generateSecurePassword()
      expect(value).toHaveLength(12)
      expect(value).toMatch(/[A-Z]/)
      expect(value).toMatch(/[a-z]/)
      expect(value).toMatch(/[0-9]/)
    }
  })
})
