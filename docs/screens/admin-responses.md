# 回答結果画面

[索引](../design-index.md) / [画像](../images.md) / [API](../api.md)

## 目的と取得

`/admin/responses`、admin専用。event_editionsをcreated_at降順で取得し、active回、なければ先頭を選択。list_admin_submissions(p_event_id)とcount_registered_usersを並列取得します。ページネーションはありません。

共通Headerにライト／ダークテーマの切替を表示します。端末連動と保存規則は[共通設計](../architecture.md)を参照します。

## 集計・ランキング・一覧

| 領域 | 計算・操作 |
| --- | --- |
| 集計カード | role=userの登録件数、選択回の回答行数、max(0,登録件数−回答行数)、設定キャラクター別件数 |
| 確認済み件数 | 選択回のverified行数。回答一覧見出しへ表示 |
| ランキング | キャラクター選択後に3部門を表示。verifiedかつscore非null、スコア降順、同点はupdated_at昇順。部門ごと上位10名、上位3名を強調 |
| 検索 | trim・小文字化し、Discord名／プロデューサー名／ログインIDの部分一致 |
| 絞り込み | キャラクター、確認状態。応募部門の絞り込みUIはない |
| 並び替え | 更新日時降順、作成日時降順、評価値降順（未入力は後）、Discord名のjaロケール昇順 |
| 表示列 | 参加者、キャラクター、応募部門、評価値、初回/最終日時、状態、確認・編集 |

検索・絞り込みは一覧とCSVだけへ適用し、集計・ランキングには適用しません。レビューなしは未確認。設定にないキャラクターは一覧でID文字列として表示され、設定キャラクターのランキングには入りません。

登録件数からadminを除外する一方、回答行数はadminの回答も含みます。未回答者数は厳密な「未回答userをDBで数えた値」ではありません。

## 回答確認モーダル

「確認・編集」で状態をセットし、最新回答と画像を取得。画像3種、評価値、状態、管理者メモ（最大1,000文字）を表示します。画像は新規タブで開けます。

結果画像あり（score非nullかつdeckなし）の場合のみ評価値・状態を編集可能。評価値は空欄または0以上のJavaScript安全整数。結果画像なしでもメモは編集できます。画像取得中は画像領域にスピナーを出し、一部失敗は画面上部へエラーを出します。

保存はsubmission_reviewsをsubmission_idでupsert。メモはtrim。評価値・状態を編集可能な回答をverifiedで保存するとクライアント時刻とsession.user.idを確認日時・確認者に設定し、それ以外の状態ではnullにします。編集不可時は既存の評価値・状態を保持し、既存状態がverifiedなら確認日時・確認者も保持します。成功時はモーダルを閉じて一覧を再取得、失敗時は固定文言を表示します。

画像の最新取得はsubmissionsだけであり、reviewを同時再取得するわけではありません。楽観ロックや競合チェックはありません。モーダルは保存ボタンをdisabledにしますが、保存中の共通閉じる操作を一律には禁止していません。

## CSV

現在のfiltered配列と順序でブラウザー内生成。UTF-8 BOM、CRLF、全セル二重引用符で囲み、内部引用符を二重化。ファイル名は `responses-YYYY-MM-DD.csv`（UTC日付）。

列はログインID、Discord名、プロデューサー名、キャラクター、応募部門、確認済み評価値、状態、メモ、初回回答日時、最終更新日時。日時はDB文字列、画像とURLは含めません。数式先頭文字を無害化する専用処理はありません。

## 現行の失敗・状態保持

開催回取得失敗と一覧取得失敗を個別の日本語文言で表示。count RPCのerrorは個別表示せずdataがなければ0。開催回を変えても検索・絞り込み・sortはリセットされません。旧回で選択したキャラクターフィルターが残ると新回が空表示になる場合があります。読込中に一覧を必ず空へ戻す設計ではありません。

## 照合シナリオ（ソース確認）

- 過去回選択、検索、2種類の絞り込み、4種類のsort。
- 全件集計とfiltered一覧の件数差を許容。
- 結果画像なしのレビュー編集制限。
- verifiedでもscore空欄ならランキング対象外。
- CSV列順・BOM・引用符処理。

## 実装根拠

[ResponsesPage.tsx](../../src/pages/ResponsesPage.tsx)、[adminResponses.ts](../../src/lib/adminResponses.ts)、[ranking.ts](../../src/lib/ranking.ts)、[ResponseStats.tsx](../../src/components/responses/ResponseStats.tsx)、[ResponseRankings.tsx](../../src/components/responses/ResponseRankings.tsx)、[ResponsesTable.tsx](../../src/components/responses/ResponsesTable.tsx)、[ResponseModals.tsx](../../src/components/responses/ResponseModals.tsx)、[useReviewImages.ts](../../src/hooks/useReviewImages.ts)。
