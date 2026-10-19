import type { MockEntryScenario } from '../../lib/supabase'

const scenarios: [MockEntryScenario, string][] = [
  ['normal', '通常（保存済み回答から計算）'],
  ['tie', '同点の相手が1つ上'],
  ['zero', '1つ上の相手が0ポイント'],
  ['below-ten', '本人が11位以下'],
  ['first', '現在1位'],
  ['pending', '確認待ち（非表示）'],
  ['invalid', '対象外（非表示）'],
  ['no-score', '得点未登録（非表示）'],
  ['error', 'ポイント取得失敗'],
  ['before', '応募受付開始前（非表示）'],
  ['after', '応募受付終了後（非表示）'],
]

export function MockRankScenarios({ value, onChange }: {
  value: MockEntryScenario
  onChange: (value: MockEntryScenario) => void
}) {
  return (
    <details className="mock-rank-controls">
      <summary>モック確認：ポイント表示（v6）</summary>
      <p>表示状態だけを模擬します。回答データは変更しません。この確認欄は本体には追加しません。</p>
      <label>
        確認する状態
        <select value={value} onChange={(event) => onChange(event.target.value as MockEntryScenario)}>
          {scenarios.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <p>通常はuser1で28,000、user2・user4で「現在1位です」。user3・user5・未回答のadminは非表示です。</p>
      <p>取得失敗には再試行ボタンがありません。状態を「通常」に戻すか、参加履歴へ移動して回答入力を開き直してください。再読み込みでモック全体が初期化されます。</p>
    </details>
  )
}
