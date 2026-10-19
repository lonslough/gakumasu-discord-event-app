# 実装と設計書の照合記録

[索引](design-index.md)

確認日：2026-10-04。対象は作業ツリー内のsrc、supabase/migrations、supabase/functions、公開ファイル、Docker・Vite設定、GitHub Workflowsです。実装を正本とし、相違は文書側を修正します。READMEにある旧説明をそのまま仕様の根拠にしません。

## 第1回：画面・処理・設定の照合

初稿作成後に全5画面の文書を読み直し、画面内の入力制約、disabled条件、状態変更、RPC/テーブル呼出を突き合わせました。開催回SQL、Storage経路、Pages/Supabase Workflow条件も確認しました。

- 修正：レビュー保存の確認日時・確認者は常に更新するわけではありません。画像未提出で編集不可かつ既存verifiedの場合は既存値を保持するため、回答結果の設計書を修正しました。
- 確認：部門は登録後固定、キャラクターは開催回ごとの2名、ランキングはキャラクター×3部門、レビューなしは未確認です。
- 確認：全5画面に根拠ファイル・通常/失敗分岐を記載し、旧ルートと未定義ルートも索引へ対応付けました。

## 第2回：データ・権限・画像経路の再照合

共通設計、全テーブル、RPC/4つのFunction、画像処理、実行設定を読み直し、最終migrationによる上書きとクライアントの呼出順を再照合しました。画面設計も保存・読取契約の観点で見直しました。

- 修正：DEVのactive画像保存は生成済みBlobを直接キャッシュし、開催回切替はZIPを取得・展開します。images.mdで両経路を分けました。
- 修正：APIのJSON応答はjsonヘルパーの応答に限定し、OPTIONSの本文はokと明記。JWTゲートウェイによる先行拒否とハンドラーの403も区別しました。
- 確認：レビュー画像の上書き禁止、未参照画像だけの削除、beginner証明制約のNOT VALID、最終set_active_event権限、service_roleと呼出元JWTの扱いを現行コードに合わせて記載しています。

## 第3回：全体の対応関係・文書間整合・参照の最終照合

全画面・共通設計を横断して、件数、期間、画像サイズ、URL期限、キャッシュ、認証、保存順序の説明を再確認しました。前2回の修正も元の分岐へ戻って再確認し、索引・実装根拠・スキル参照の機械的チェックを併用しました。

- 修正：画像JSON取得失敗時に保持するのは常に既定画像ではなく「現在の画像」です。DEVではローカルキャッシュを優先することと、既定画像の完全なパスをimages.mdへ反映しました。
- 修正：Composeの公開キー変数名を省略せず `VITE_SUPABASE_ANON_KEY` と記載しました。
- 確認：設計書12ファイル、実画面5件、ルート7件（旧URL・未定義URLを含む）、Edge Functions4件、テーブル5件の対応を確認しました。
- 確認：README・設計書・SKILL.mdのローカルリンク153件に欠落なし。コードフェンスの対応、git diff --check、skill-creatorのquick_validate.pyも合格しました。
- 結果：3回の静的照合で見つけた文書の相違は修正済みです。実装側の制限・例外経路を文書へ明記し、アプリのコードは変更していません。

確認時HEAD：`b5be24772e6542e7a4ed825ecf70625e6a4ca645`。対象はHEADだけでなく当日の作業ツリーです。

## 確認方法の限界

本記録はソースコードと文書の静的照合です。今回、ブラウザー操作、実DBへのmigration適用、RLSの実行検証、本番デプロイ、既存テストの実行は行っていません。画面文書の照合シナリオは手動テスト合格記録ではありません。実装内で環境依存の成功が確定できない箇所は、成功を断定せず現行の処理と未検証事項を記載しています。

## 2026-10-05 テーマ機能の検証

ライト／ダークテーマ、端末設定との連動、手動選択の保存を追加し、実装と共通設計・ログイン画面設計を同期しました。`npm run docker:lint`、`npm run docker:test`（8ファイル・51件）、`npm run docker:build` は成功しています。テーマの単体テストは端末設定の取得、手動選択の保存とDOM反映、無効な保存値の除外を確認します。

Docker開発環境は `http://localhost:5173/` で起動できましたが、このセッションに操作可能なブラウザーが接続されていなかったため、全5画面のブラウザー手動確認は未実施です。

## 2026-10-06 参加履歴の実装・検証（ブラウザー確認保留）

本人の全参加回・確認済み得点・提出画像を表示する `/history` を追加しました。既存5画面と新規履歴、旧 `/admin/rules`、未定義URLの計8ルートを索引へ対応付け、共通Header・認証・API・DB・画像設計を更新しました。既存画面の実装とモーダル・RPC呼出も静的に再照合しています。

- Dockerの `npm run test`：11ファイル76件成功。履歴9件、画像4件、認証/遷移12件を含みます。画面遷移テストは各ページを簡略表示へ置き換えたガード/ルーティングの検証であり、実画面の描画検証ではありません。
- `npm run lint` / `npm run build`：成功。既存heic2anyの大きなチャンクに関するビルド警告あり。
- 新しいmigrationを `supabase migration up --local` でローカルDBへ適用。DB resetは未実施。`supabase db lint --local --level warning --fail-on warning`：成功。
- [DBテスト](../supabase/tests/submission_history.sql)：psql経由で13件すべてok、最後にrollback。本人/他人/adminの範囲、匿名権限、並び順、現在回、レビューなし、0点、未確認/無効得点の非公開、管理メモ/確認者の非公開を実DBで確認。
- Docker内Supabase CLIによるtest dbはホスト側のパスマウント問題でNOTESTSとなったため、成功とは扱わず同一SQLをDBへ直接渡して検証しました。
- 初回の追加UIテストではDOMの後片付け不足で3件失敗。各テストのcleanupを追加後、全76件成功。
- ローカル文書リンクとgit diff --checkを確認。

ブラウザーの初期接続は「No browser is available」、復旧手順による一覧も空でした。AC-01〜06の自動/DB検証は実施済みですが、実ブラウザーの画像描画・再読込・PC/スマートフォン表示と全画面の手動回帰（AC-07を含む）は未実施です。操作可能なブラウザーを接続し、ローカル `http://localhost:5173/` で一般ユーザーと管理者の確認を再開する必要があります。手動検証完了とは扱いません。本番反映・pushは行っていません。

## 2026-10-12 開催回切替の管理者認証修正

activate-eventがservice_roleクライアントでset_active_eventを呼んでいたため、DB側のauth.uid()による管理者判定で `administrator required` が発生していました。requireAdminに返却クライアントの種別を追加し、activate-eventの開催回読取・切替・復元では検証済み呼出元JWTをAuthorizationへ設定します。ユーザー作成・パスワード再発行は従来のservice_roleクライアントを使用します。DB関数の管理者チェック・実行権限は変更していません。

- Dockerの `npm run test`：14ファイル99件成功。追加したEdge Functionテスト10件は実SDKとHTTP応答スタブを使い、JWT引継ぎ、復元、一般ユーザー/無効JWT/未認証の拒否、画像必須、ローカル切替、既存service_role経路、エラーログを確認します。
- [DBテスト](../supabase/tests/event_activation.sql)：ローカルDBへpsql経由で実行して11件すべてok、最後にrollback。管理者の切替・復元、一般ユーザーの拒否、本人情報なしservice_roleの拒否、active一件制約、存在しない開催回の拒否を確認。Supabase Workflowにも実行を追加しました。
- Deno 2.4.5の `deno check --frozen`：Edge Functions4件成功。
- `npm run lint` と `git diff --check`：成功。

本番への反映・pushは未実施です。ブラウザー操作と本番での切替確認は未実施で、ローカルのDB権限テストとHTTP応答スタブによるFunction検証を行っています。

## 2026-10-12 SupabaseデプロイのIPv4接続修正

Actionsのdb push --linkedがIPv6へ接続して失敗するため、Management APIからPRIMARYの共有poolerを取得し、Session modeの5432番・TLS必須の接続URLを明示してdb push --db-urlを実行するようWorkflowを変更しました。既存のSecretsを使用し、URL内パスワードをエンコードしてURL全体をActionsログでマスクします。API取得・接続先検証の失敗はDB更新前に停止します。inbucketの非推奨警告は今回の接続失敗原因ではなく、設定は変更していません。

- 接続設定テスト14件と既存自動マージ保護テスト21件、計35件成功。API応答・ネットワークはスタブで、対象プロジェクト/PRIMARYの選択、Session modeへの変換、秘密情報のマスク、API403/不正JSON等の停止を検証。
- 同じSupabase CLI 2.109.1でローカルDBへ明示URLによるdb push --dry-runを実行し、Local database is up to dateを確認。DBへの適用は行っていません。
- Workflow YAMLの解析、Lint、git diff --checkは成功。

本番APIからのpooler取得、本番DBへの接続・適用、Actionsの再実行、pushは未実施です。ローカルdry-runは本番pooler接続成功の証明ではありません。

## 2026-10-12 pooler設定取得APIの403対応

本番Actionsでpooler設定取得APIがHTTP403を返したため、SUPABASE_DB_POOLER_HOST指定時はAPIを呼ばずに接続URLを作成する経路を追加しました。ユーザーがDashboardのSession poolerで確認した `aws-0-ap-northeast-1.pooler.supabase.com` をWorkflowの標準値に設定し、任意の同名Actions Variableで上書きできます。DBパスワードは既存Secretを使用し、URLエンコード・ログのマスク・TLS必須・対象プロジェクトの検証を維持しています。

- 接続設定22件と自動マージ保護21件、計43件成功。Host指定経路はAPIが呼ばれると失敗するスタブで検証し、API読取トークンなしでも接続URLを作成できること、不正Hostの拒否を確認。
- ユーザーが確認したHostのIPv4 DNS解決とTCP5432番への接続は成功。認証情報は送信せず、DBへのログイン・更新は未実施です。
- Workflow YAML解析、Lint、git diff --checkは成功。

本番Actionsの再実行、実DB認証、Function配信、pushは未実施です。Function配信には引き続き対象プロジェクトへデプロイできるトークンが必要です。

## 2026-10-20 回答入力：1つ上の順位のポイント

モックv6に対するユーザーの「承認する」を受領し、本体の回答入力にポイント欄を追加しました。同じ開催回・キャラクター・応募部門の本人の保存済み回答を基準とし、受付中だけ表示します。追加RPCは相手の得点だけを返し、既存RLS・回答保存ルールは変更していません。

- Node.js 22.14.0のローカルDocker環境で `npm run test` は15ファイル110件成功。追加した[画面テスト](../src/pages/EntryPage.test.tsx)11件は通常・0点・1位・非表示、未保存選択、保存後更新、期間終了時の更新、失敗時の入力保持・再試行ボタンなし、古い応答の破棄を確認。型・lint指摘のあったテスト記述を修正後、この11件を再実行して成功。
- `npm run lint`、`npm run build`、`git diff --check`成功。本番向けビルドは生成のみで公開していません。画像変換依存を含む大きなchunkの既存サイズ警告があります。
- ローカルDBへ追加migrationのみ `supabase migration up --local`で適用。DB resetは実行せず、既存データを維持。`supabase db lint --local --level warning --fail-on warning`はエラーなし。
- [ポイントDBテスト](../supabase/tests/entry_rank_neighbor.sql)25件、既存参加履歴13件・受付対象切替11件の計49件成功。同点・0点・11位以下・グループ分離・未確認/無効/null除外・匿名/本人/管理者・期間境界を確認し、最後にrollback。Compose内CLIからはテストSQLのマウントに失敗したため、ホストのプロジェクトを直接read-onlyマウントしたpg_proveコンテナーで同じSQLを実行しました。
- 実際のローカルAuthとPostgRESTを使用したHTTP検査18項目成功。READMEの一般・管理者アカウントでログインし、限定レスポンス・未認証拒否・任意user_id指定拒否・一般ユーザーの管理メモSELECT拒否を確認。トークン・鍵は記録していません。ローカルアプリは `http://localhost:5173/entry` で応答し、追加コンポーネントを配信しています。

全6画面とRoutes.tsxの対応を再照合しました。`/login`、`/entry`、`/history`、`/admin/users`、`/admin/responses`、`/admin/settings`、旧`/admin/rules`転送、未定義URLの転送は維持。変更した回答入力・API・DB・共通設計・運用を既存の正本へ統合し、その他の画面設計は既存ソースを参照しました。認証と主要遷移は既存Routesテスト12件、履歴・設定・画像UI等は同じ110件のテスト一式で回帰確認しています。全画面を実ブラウザーで手動確認した記録ではありません。

**ブラウザー手動検証は保留**です。Browserスキルの接続確認で利用可能なブラウザーは0件。PC／スマートフォン・ライト／ダークの実描画、全画面の手動操作、画像選択から実保存・再読込までの一連の操作は未確認です。自動テスト・HTTP検査を手動検証済みとは扱いません。ブラウザー接続が復旧したら回答入力の表示・保存・再訪・期間境界と全画面の主要遷移を確認します。本番へのmigration適用・デプロイ・pushは行っていません。
