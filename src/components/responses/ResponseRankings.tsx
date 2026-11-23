import { useEffect, useState } from 'react'
import type { Category, CharacterOption, EntryDivision } from '../../types'
import type { DivisionSettings } from '../../types'
import { divisionLabel, divisionIds } from '../../lib/divisions'

export interface RankingDisplayRow {
  id: string
  discord_username: string
  producer_name: string
  review: { confirmed_score: number | null } | null
}

interface ResponseRankingsProps {
  rankings: Record<Category, Record<EntryDivision, RankingDisplayRow[]>>
  divisionSettings?: DivisionSettings
  characters: CharacterOption[]
}


export function ResponseRankings({ rankings, characters, divisionSettings }: ResponseRankingsProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>(characters[0]?.id ?? '')
  useEffect(() => {
    if (!characters.some((character) => character.id === selectedCategory))
      setSelectedCategory(characters[0]?.id ?? '')
  }, [characters, selectedCategory])
  if (!selectedCategory || !rankings[selectedCategory]) return null
  return (
    <section className="card ranking">
      <div className="ranking-heading">
        <fieldset className="ranking-selector">
          <legend>ランキング部門</legend>
          {characters.map((character) => (
            <label key={character.id}>
              <input
                type="radio"
                name="ranking-category"
                value={character.id}
                checked={selectedCategory === character.id}
                onChange={() => setSelectedCategory(character.id)}
              />
              {character.name}
            </label>
          ))}
        </fieldset>
        <span className="ranking-note">確認済みのみ</span>
      </div>
      <div className="ranking-title">
        <h2>{characters.find((character) => character.id === selectedCategory)?.name}ランキング</h2>
      </div>
      <div className="ranking-divisions">
        {divisionIds(divisionSettings).map((division) => {
          const rows = rankings[selectedCategory][division] ?? []
          return (
            <section className="division-ranking" key={division}>
              <h3>{divisionLabel(divisionSettings, division)}</h3>
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
