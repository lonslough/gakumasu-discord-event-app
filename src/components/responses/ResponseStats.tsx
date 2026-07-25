import type { ResponseStats as Stats } from '../../lib/adminResponses'

interface ResponseStatsProps {
  registered: number
  stats: Stats
}

export function ResponseStats({ registered, stats }: ResponseStatsProps) {
  const items = [
    ['登録ユーザー数', registered],
    ['回答者数', stats.submitted],
    ['未回答者数', stats.unsubmitted],
    ['十王星南部門', stats.byCategory.sena],
    ['雨夜燕部門', stats.byCategory.tsubame],
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
