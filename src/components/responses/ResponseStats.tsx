import type { ResponseStats as Stats } from '../../lib/adminResponses'
import type { CharacterOption } from '../../types'

interface ResponseStatsProps {
  registered: number
  stats: Stats
  characters: CharacterOption[]
}

export function ResponseStats({ registered, stats, characters }: ResponseStatsProps) {
  const items = [
    ['登録ユーザー数', registered],
    ['回答者数', stats.submitted],
    ['未回答者数', stats.unsubmitted],
    ...characters.map((character) => [`${character.name}部門`, stats.byCategory[character.id] ?? 0] as const),
  ] as const

  return (
    <div className="stats-grid">
      {items.map(([label, value]) => (
        <div className="stat card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  )
}
