export type EntryRankResult =
  | { status: 'ranked'; higher_score: number }
  | { status: 'loading' | 'first' | 'unranked' | 'closed' | 'error'; higher_score: null }

export function EntryRankPoints({ result }: { result: EntryRankResult }) {
  if (result.status === 'unranked' || result.status === 'closed') return null

  return (
    <section className="entry-rank-points" aria-labelledby="entry-rank-heading" aria-busy={result.status === 'loading'}>
      <h2 id="entry-rank-heading">1つ上の順位のポイント</h2>
      <div aria-live="polite">
        {result.status === 'loading' && <div className="spinner" aria-label="ポイントを読み込み中" />}
        {result.status === 'ranked' && <p className="entry-rank-score">{result.higher_score.toLocaleString('ja-JP')}</p>}
        {result.status === 'first' && <p className="entry-rank-first">現在1位です</p>}
        {result.status === 'error' && <p className="field-error" role="alert">ポイントを取得できませんでした</p>}
      </div>
    </section>
  )
}
