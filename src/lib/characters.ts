import type { CharacterOption } from '../types'

export const characterRoster: CharacterOption[] = [
  { id: 'saki', name: '花海 咲季', shortName: 'SAKI', enabled: true },
  { id: 'temari', name: '月村 手毬', shortName: 'TEMARI', enabled: true },
  { id: 'kotone', name: '藤田 ことね', shortName: 'KOTONE', enabled: true },
  { id: 'mao', name: '有村 麻央', shortName: 'MAO', enabled: true },
  { id: 'lilja', name: '葛城 リーリヤ', shortName: 'LILJA', enabled: true },
  { id: 'china', name: '倉本 千奈', shortName: 'CHINA', enabled: true },
  { id: 'sumika', name: '紫雲 清夏', shortName: 'SUMIKA', enabled: true },
  { id: 'hiro', name: '篠澤 広', shortName: 'HIRO', enabled: true },
  { id: 'rinami', name: '姫崎 莉波', shortName: 'RINAMI', enabled: true },
  { id: 'ume', name: '花海 佑芽', shortName: 'UME', enabled: true },
  { id: 'misuzu', name: '秦谷 美鈴', shortName: 'MISUZU', enabled: true },
  { id: 'sena', name: '十王 星南', shortName: 'SENA', enabled: true },
  { id: 'tsubame', name: '雨夜 燕', shortName: 'TSUBAME', enabled: true },
]

export const defaultCharacterOptions: CharacterOption[] = characterRoster.filter(
  (character) => character.id === 'sena' || character.id === 'tsubame',
)

export function characterLabel(
  characters: CharacterOption[],
  id: string,
): string {
  return characters.find((character) => character.id === id)?.name ?? id
}

export function normalizeCharacterId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
