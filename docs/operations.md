# 実行・配信・品質設計

[索引](design-index.md) / [利用手順](../README.md)

## ローカル構成

package.jsonのNode要件は22.12.0以上。Dockerfileはnode:22.14.0-alpineでnpm ci。Dockerfile.supabaseは同Nodeイメージへdocker-cliとSupabase CLI 2.109.1を配置します。

Compose webは5173公開、backendのhealthcheck成功後に共有supabase_runtimeの環境ファイルを読み、API_URLをVITE_SUPABASE_URLへ、ANON_KEYをVITE_SUPABASE_ANON_KEYへ設定してViteを起動。src・public・設定をbind mountし、node_modules・distを名前付きVolumeに保存します。

backendはhost network、Dockerソケットとリポジトリ全体をmountし、supabase start、statusのenv出力、待機を行います。終了時はsupabase stop。healthcheckは環境ファイルの存在/非空を検査します。

config.tomlはPostgreSQL 15、API 54321、DB 54322、shadow 54320、Studio 54323、Inbucket 54324。Authの自己登録は無効、JWT期限3600秒。seedはローカル検証用のadmin/userを作成し、本番Workflowはinclude-seedを指定しません。

起動は `docker compose up --build`、品質チェックは `docker compose run --rm --no-deps web npm run <lint|test|build>`。ホスト起動時はnpm ciと `.env.example` 相当の接続設定を使用します。既存node_modules Volumeはイメージ再構築だけでは更新されないため、依存変更時はVolume内でnpm ciを実行します。DB resetはローカルデータを消去して全migrationとseedを再適用します。

## ローカル環境の操作

Docker DesktopではHost networkingを有効にします。MacでDockerソケットの場所が異なる場合は `DOCKER_HOST_SOCKET` に実際のソケットパスを指定します。通常のCompose起動では接続情報の `.env` への転記は不要です。ホストでViteを起動する場合のみ [.env.example](../.env.example) を参考に設定します。

```bash
docker compose exec backend supabase status
docker compose stop backend
```

ローカルDBを初期化する場合は次を実行します。既存のローカル回答・ユーザーも消去されます。

```bash
docker compose exec backend supabase db reset
```

`docker compose down --volumes` はCompose管理の依存パッケージ・ビルド成果物・接続情報のVolumeも削除します。Supabase CLIが別途管理するDBの初期化とは区別してください。ローカルseedの検証アカウントはadminが `test` / `test`、userが `user` / `user`（ID / パスワード）です。

ローカルSeederは上記2アカウントに加え、一般ユーザーの6開催回分の回答と5件のレビューを作成します。確認済みの通常得点・0点・得点未登録、確認待ち、対象外、レビュー未作成を含み、最後のサンプル開催回を受付中にします。管理者本人の履歴は空です。画像ファイル・初心者部門の証明画像は生成しません。`supabase/seed.sql` は初回作成・ローカルDBリセット専用で、単独再実行には対応しません。

## 本番の初期セットアップ

SupabaseプロジェクトとGitHubリポジトリを用意し、認証のEmailプロバイダーを使用します。接続URLと公開用キーは [.env.production.example](../.env.production.example) を参考に設定します。Service Role KeyはFunctionのサーバー側でのみ使用します。

Supabase CLIで対象プロジェクトを指定し、全マイグレーションを順番に適用します。

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy
```

StorageバケットとRLSもmigrationで作成します。バケットの公開設定を手作業で変更しません。デプロイする4Functionと認証設定は [API設計](api.md) を参照してください。継続運用開始後は適用済みSQLを変更せず、新しいmigrationを追加します。

### 初期管理者

通常画面は一般ユーザーだけを作成します。初期管理者はSupabaseのAuthentication管理画面で `admin@app.invalid` と強いパスワードを指定し、確認済みのAuthユーザーとして作成します。そのUUIDでプロフィールを登録します。

```sql
insert into public.profiles (id, user_id, role)
values ('AUTH_USER_UUID', 'admin', 'admin');
```

既存プロフィールの昇格は対象UUIDを確認して `update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';` を実行します。別のIDを使用する場合の内部メール変換規則はAPI設計に従います。

### GitHubの設定

| 設定先 | 名前 |
| --- | --- |
| Actions Variables | VITE_SUPABASE_URL、SUPABASE_PROJECT_ID |
| Actions Secrets | VITE_SUPABASE_ANON_KEY、SUPABASE_ACCESS_TOKEN、SUPABASE_DB_PASSWORD |
| Environments | Supabase用production、Pages用github-pages |

Pagesの配信元をGitHub Actionsに設定します。SupabaseのSite URL / Redirect URLsも公開URLに合わせます。production環境の承認者・対象ブランチは運用に合わせて設定してください。

### ページ画像の公開連携

GitHub Appを対象リポジトリへインストールし、Actionsの読み書き権限を付与します。Function側へGITHUB_APP_ID、GITHUB_APP_INSTALLATION_ID、GITHUB_APP_PRIVATE_KEY、GITHUB_REPOSITORY、必要に応じてGITHUB_PAGES_BRANCHを設定します。秘密鍵は実装が読み込むPKCS#8形式（BEGIN PRIVATE KEY）を使用します。

FunctionとActions Secretに同一のPAGE_DEPLOY_SECRETを設定し、Actions VariableのPAGE_IMAGES_ENDPOINTを `https://PROJECT_REF.supabase.co/functions/v1/page-images-archive` にします。Functionの追加設定は `npx supabase secrets set NAME=VALUE` で登録します。実値・秘密鍵をコミットしません。

連携を有効にする前に、設定画面で受付対象の開催回のページ画像を保存します。公開処理と保存・切替の違いは [画像設計](images.md) と [設定画面](screens/admin-settings.md) を参照してください。

## 環境変数の境界

| 設定 | 用途 |
| --- | --- |
| VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY | 公開フロント接続情報 |
| SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY | Functionランタイムの管理クライアント |
| GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / GITHUB_APP_PRIVATE_KEY | FunctionからWorkflow起動する認証 |
| GITHUB_REPOSITORY / GITHUB_PAGES_BRANCH | 起動先owner/repoとbranch（既定main） |
| PAGE_DEPLOY_SECRET | FunctionとActionsが共有するZIP取得認証 |
| PAGE_IMAGES_ENDPOINT | Actions Variable、ZIP署名URL取得FunctionのURL |
| SUPABASE_ACCESS_TOKEN / SUPABASE_DB_PASSWORD / SUPABASE_PROJECT_ID | ActionsからSupabaseデプロイ |

秘密値は文書・フロント成果物へ記載しません。ViteのbaseはGITHUB_ACTIONS有効時にGITHUB_REPOSITORYから計算します。

## GitHub Actions

| Workflow | 起動条件 | 処理 |
| --- | --- | --- |
| deploy.yml | main push、develop向けPR、手動 | 非PRかつPAGE_IMAGES_ENDPOINT設定ありならactive画像ZIPを取得してpublicへ展開。Node22、本番とmock/sourceのnpm ci、mock再ビルド、lint/test/build（dist/mockへ実行ファイルを同梱）。非PRだけPages配信 |
| supabase-deploy.yml | develop向け全PR、main pushの対象ファイル変更、手動 | Node22で接続設定テスト、DB起動、migration適用、DB lint・権限テスト、Deno2.4.5で4Function型検査。非PRだけproductionへIPv4 Session poolerでDB push後Function一括deploy |
| auto-merge.yml | 両検証Workflowの完了、develop向けPRのready_for_review | develop向け非ドラフトPRについて、最新コミット・現在のbaseに対応する両Workflowの最新実行が成功した場合だけマージ |

Supabaseのmain push対象パスはsupabase/**、deno.lock、同Workflow自身、接続設定スクリプトとそのテスト。develop向けPRでは両検証を必ず実行し、未開始・実行中・失敗・キャンセル・スキップは自動マージの成功条件を満たしません。マージAPIには検証済みのhead SHAを指定し、確認後に新しいコミットが追加された場合はマージを拒否します。権限のある自動マージWorkflowではPRコードをcheckout・実行しません。workflow_runの起動にはauto-merge.ymlがデフォルトブランチに存在する必要があります。

Pages concurrencyはPR番号ごと（本番はpages-production）で進行中をキャンセル、SupabaseもPR番号ごと（本番はsupabase-production）で直列化しキャンセルしません。別PRや本番配信との競合を避けます。Pages配信environmentはgithub-pages、Supabaseはproduction。main向けPRは検証・自動マージの対象外です。

本番DBの接続先は [接続設定スクリプト](../scripts/supabase-db-connection.mjs) が既存SUPABASE_ACCESS_TOKENを使ってManagement APIから取得します。PRIMARYの共有poolerを選び、Session modeの5432番・TLS必須のURLを作成し、`supabase db push --db-url` へ渡します。IPv6の直接接続やlink時のpoolerキャッシュには依存しません。SUPABASE_DB_PASSWORDはURLエンコードし、URL全体をActionsログでマスクしてからGITHUB_ENVへ保存します。API取得・検証失敗時はDB更新前に停止し、トークンには `database_pooling_config_read` 権限が必要です。リージョンから接続ホストを推測しません。追加Secretsは不要です。

Pagesの画像取得は共有secret→900秒署名URL→ZIPダウンロード→展開。エンドポイント未設定なら組み込みpublicを使用し、設定済みで取得が失敗すればbuildへ進みません。Supabase DB適用が失敗すればFunction配信を開始せず、自動rollbackはしません。

## テストの実装範囲

Vitest、jsdom、Testing Library。npm run testはvitest run、buildはtsc -b後vite build、lintはeslint。

参加履歴はHistoryPage/HistoryImageのコンポーネントテストとRoutesの認証・遷移テストで検証します。DB権限テストは `supabase test db supabase/tests/submission_history.sql`。Supabase WorkflowでもDB lint後に実行します。ローカルDBでテスト専用データをトランザクション内に作成し、最後にrollbackするため既存の回答や開催回は残ります。

Compose内のSupabase CLIからテスト用コンテナを起動すると、Dockerホストに `/workspace` が存在せずテストSQLをマウントできない場合があります。その場合は同SQLをローカルDBコンテナのpsqlへ標準入力で渡し、ON_ERROR_STOPを有効化して実行し、TAP結果が全件okであることを確認します。

既存テストはID/内部メール・画像/応募フォーム検証、パスワード生成、ランキング、検索/絞込/集計/CSV、回答保存順序/失敗時回収/期間タイマー、ページ画像プレビュー、canvas調整を対象とします。Supabaseモックやcanvasモックを用いるテストを含み、実DB RLSやブラウザーE2Eの成功を保証するものではありません。今回の設計書作成ではソース照合を実施し、テスト実行済みとは扱いません。

## 実装根拠

[package.json](../package.json)、[compose.yaml](../compose.yaml)、[Dockerfile](../Dockerfile)、[Dockerfile.supabase](../Dockerfile.supabase)、[config.toml](../supabase/config.toml)、[seed.sql](../supabase/seed.sql)、[vite.config.ts](../vite.config.ts)、[Pages Workflow](../.github/workflows/deploy.yml)、[Supabase Workflow](../.github/workflows/supabase-deploy.yml)、[自動マージ](../.github/workflows/auto-merge.yml)、[テスト初期化](../src/test/setup.ts)。

## MockのPages配信

`npm run build` は本番アプリのビルド後に [package-mock.mjs](../scripts/package-mock.mjs) を実行し、mock/index.html・app.js・app.css・images/・sample/だけをdist/mock/へコピーします。mock/source、node_modules、READMEや設計書はコピーしません。Workflowではmock/sourceの依存をロックファイルで導入して `npm run build:mock` を先に実行します。

公開後は既存Pagesルートの末尾へ `/mock` を直接入力します。本番UIへリンク・メニュー・ボタンは追加しません。ディレクトリーのindex.htmlが入口、mock内はハッシュルーティングです。mockの認証・データ処理はメモリー内のままで、本番Supabaseへ接続しません。
