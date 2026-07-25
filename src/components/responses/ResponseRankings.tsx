import type { AdminSubmission, Category } from '../../types'
import { categoryName } from './labels'

interface ResponseRankingsProps {
  rankings: Record<Category, AdminSubmission[]>
}

const categories: Category[] = ['sena', 'tsubame']

export function ResponseRankings({ rankings }: ResponseRankingsProps) {
  return (
    <section className="rankings">
      {categories.map((category) => (
        <div className="card ranking" key={category}>
          <div className="ranking-title">
            <h2>{categoryName[category]}ランキング</h2>
            <span>確認済みのみ</span>
          </div>
          {rankings[category].length ? (
            <ol>
              {rankings[category].slice(0, 10).map((row, index) => (
                <li
                  className={index < 3 ? `top top-${index + 1}` : ''}
                  key={row.id}
                >
                  <span className="rank">{index + 1}</span>
                  <span>
                    <strong>{row.discord_username}</strong>
                    <small>{row.producer_name}</small>
                  </span>
                  <b>{row.review?.confirmed_score?.toLocaleString()}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">ランキング対象の回答はありません。</p>
          )}
        </div>
      ))}
    </section>
  )
}
