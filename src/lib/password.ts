const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const lower = 'abcdefghijkmnopqrstuvwxyz'
const digits = '23456789'
const all = upper + lower + digits

function secureIndex(max: number): number {
  const limit = Math.floor(256 / max) * max
  const bytes = new Uint8Array(1)
  do crypto.getRandomValues(bytes)
  while (bytes[0] >= limit)
  return bytes[0] % max
}

export function generateSecurePassword(): string {
  const chars = [
    upper[secureIndex(upper.length)],
    lower[secureIndex(lower.length)],
    digits[secureIndex(digits.length)],
  ]
  while (chars.length < 12) chars.push(all[secureIndex(all.length)])
  for (let index = chars.length - 1; index > 0; index--) {
    const target = secureIndex(index + 1)
    ;[chars[index], chars[target]] = [chars[target], chars[index]]
  }
  return chars.join('')
}
