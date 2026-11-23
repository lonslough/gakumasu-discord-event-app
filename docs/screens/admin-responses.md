# ランキング画面（旧回答結果）

[索引](../design-index.md) / [画像](../images.md) / [API](../api.md)

## 目的と取得

`/admin/responses`、user/adminともログイン必須。既存URLを維持し、Headerと画面名を「ランキング」へ変更しています。プロフィール読込完了まではスピナー、その後ロール別にビューを分けます。

adminはevent_editionsをcreated_at降順で取得し、active回、なければ先頭を選択。list_admin_submissions(p_event_id)とcount_registered_usersを並列取得します。非公開回も対象で、既存の管理操作を維持します。ページネーションはありません。

共通Headerにライト／ダークテーマの切替を表示します。端末連動と保存規則は[共通設計](../architecture.md)を参照します。

## 一般ユーザーの表示・取得

一般ユーザーに表示するのは開催回選択とランキングです。集計・検索・回答一覧・確認編集・CSVボタンは表示せず、管理用RPCや画像取得も呼びません。PublicRankingsは専用のlist_public_ranking_eventsとget_public_rankingsを使用します。

- 開催回候補はranking_published=trueの回だけで、作成日時降順。公開済みの受付対象回を初期選択し、なければ先頭の公開回を選びます。
- 公開回0件は「ランキングは公開準備中です。」。取得失敗とは区別します。
- 開催回を変えるとその回の2キャラクター・3部門を表示。既存同様、キャラクターはラジオ選択、順位は確認済み得点の降順・同点は回答更新日時昇順、各部門上位10名です。0点も対象です。
- 表示項目は順位、Discord名、プロデューサー名、確認済み得点。RPCもこれらと分類だけを返し、回答ID・ログインID・画像パス・管理者メモ・確認者・回答時刻は公開しません。得点なし・未確認・無効、設定外のキャラクター、11位以降はサーバーで除外します。
- 読込中はスピナー。回切替中は前回のランキングを隠し、cleanupと選択回IDで古い応答を破棄します。開催回取得失敗は「開催回を読み込めませんでした。」、ランキング取得失敗は「ランキングを読み込めませんでした。」。専用再試行ボタンはなく再訪・再読込で取得します。
- 公開された回に対象回答がなければ各部門に「ランキング対象の回答はありません。」。
- 選択は永続化せず、再訪・再読込で初期選択へ戻ります。公開設定変更は次回の候補取得・ランキング取得で反映し、Realtime同期や表示済みデータの回収はありません。受付期間と公開可否は独立しています。

取得・認可の詳細は[API](../api.md)、公開設定は[設定画面](admin-settings.md)を参照してください。

## 管理者の集計・ランキング・一覧

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

adminだけが使用可能。管理ビュー内にだけボタンを描画し、クリック処理でもroleを確認します。現在のfiltered配列と順序でブラウザー内生成。UTF-8 BOM、CRLF、全セル二重引用符で囲み、内部引用符を二重化。ファイル名は `responses-YYYY-MM-DD.csv`（UTC日付）。

列はログインID、Discord名、プロデューサー名、キャラクター、応募部門、確認済み評価値、状態、メモ、初回回答日時、最終更新日時。日時はDB文字列、画像とURLは含めません。数式先頭文字を無害化する専用処理はありません。

## 管理者ビューの現行の失敗・状態保持

開催回取得失敗と一覧取得失敗を個別の日本語文言で表示。count RPCのerrorは個別表示せずdataがなければ0。開催回を変えても検索・絞り込み・sortはリセットされません。旧回で選択したキャラクターフィルターが残ると新回が空表示になる場合があります。読込中に一覧を必ず空へ戻す設計ではありません。

## 照合シナリオ（ソース確認）

- 過去回選択、検索、2種類の絞り込み、4種類のsort。
- 全件集計とfiltered一覧の件数差を許容。
- 結果画像なしのレビュー編集制限。
- verifiedでもscore空欄ならランキング対象外。
- CSV列順・BOM・引用符処理。

## 実装根拠

[ResponsesPage.tsx](../../src/pages/ResponsesPage.tsx)、[adminResponses.ts](../../src/lib/adminResponses.ts)、[ranking.ts](../../src/lib/ranking.ts)、[ResponseStats.tsx](../../src/components/responses/ResponseStats.tsx)、[ResponseRankings.tsx](../../src/components/responses/ResponseRankings.tsx)、[ResponsesTable.tsx](../../src/components/responses/ResponsesTable.tsx)、[ResponseModals.tsx](../../src/components/responses/ResponseModals.tsx)、[useReviewImages.ts](../../src/hooks/useReviewImages.ts)。

一般向けは[PublicRankings.tsx](../../src/components/responses/PublicRankings.tsx)、[限定RPC](../../supabase/migrations/20261123000000_add_public_rankings.sql)、[画面テスト](../../src/pages/ResponsesPage.test.tsx)、[DBテスト](../../supabase/tests/public_rankings.sql)。2026-11-23: 画面・DB・実HTTPの検証済み。PC／スマートフォンの実描画・実CSV保存と全画面の手動操作はブラウザー操作の利用拒否により保留。[検証記録](../verification.md)を参照。

2026-11-23 履歴順位追加時の全画面照合: ResponsesPage/PublicRankingsの公開回取得、管理者一覧・レビュー/画像モーダル・CSVを照合。公開ランキングは上位10名、参加履歴は非公開回も含む本人の全順位を取得する別経路です。管理者画面の確認状態は従来どおり表示します。 全152テストで既存の画面/ルートを回帰確認。ブラウザー実描画・全画面手動操作は保留。[検証記録](../verification.md)。
