import { useState } from 'react'
import type { AdminSubmission, Category, EntryDivision } from '../../types'
import { categoryName, entryDivisionName } from './labels'

interface ResponseRankingsProps {
  rankings: Record<Category, Record<EntryDivision, AdminSubmission[]>>
}

const categories: Category[] = ['sena', 'tsubame']
const divisions: EntryDivision[] = ['open', 'switch_off', 'beginner']

export function ResponseRankings({ rankings }: ResponseRankingsProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>('sena')
  return (
    <section className="card ranking">
      <div className="ranking-heading">
        <fieldset className="ranking-selector">
          <legend>ランキング部門</legend>
          {categories.map((category) => (
            <label key={category}>
              <input
                type="radio"
                name="ranking-category"
                value={category}
                checked={selectedCategory === category}
                onChange={() => setSelectedCategory(category)}
              />
              {categoryName[category]}
            </label>
          ))}
        </fieldset>
        <span className="ranking-note">確認済みのみ</span>
      </div>
      <div className="ranking-title">
        <h2>{categoryName[selectedCategory]}ランキング</h2>
      </div>
      <div className="ranking-divisions">
        {divisions.map((division) => {
          const rows = rankings[selectedCategory][division]
          return (
            <section className="division-ranking" key={division}>
              <h3>{entryDivisionName[division]}</h3>
              {rows.length ? (
                <ol>
                  {rows.slice(0, 10).map((row, index) => (
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
            </section>
          )
        })}
      </div>
    </section>
  )
}
