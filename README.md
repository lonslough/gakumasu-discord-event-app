# 強化月間イベント回答受付アプリ

Discordサーバー内イベントの応募情報と画像を受け付けるReact SPAです。GitHub Pagesは静的配信だけを担い、認証・DB・非公開画像・管理APIはSupabaseで保護します。ゲーム公式の画像やロゴは使用していません。

## 統合仕様

この節は、当初要件の [PROMPT.md](PROMPT.md) と追加要件の [PROMPT2.md](PROMPT2.md) を統合した仕様です。追加要件と現在の実装を優先し、用語が衝突していた「育成キャラクター」と「応募部門」は別項目として整理しています。

### 目的と利用者

Discordサーバー内で開催する「強化月間」イベントについて、参加者から応募情報と確認画像を受け付けます。

- 管理者はユーザーIDとランダムパスワードを発行し、Discord経由で参加者へ渡す
- 一般ユーザーはログイン後、自分の回答を登録・更新できる
- 管理者はユーザー登録、パスワード再発行、全回答・画像の確認、レビュー、ランキング表示、CSV出力を行える
- 権限は `profiles.role` の `user` / `admin` で管理する

### 認証とユーザーID

画面ではユーザーIDとパスワードを入力し、内部では `${normalizedUserId}@app.invalid` をSupabase Authへ渡します。内部メールアドレスは画面に表示しません。

ユーザーIDの規則：

- 前後の空白を除去し、英字を小文字へ変換する
- 長さは3文字以上32文字以下
- 半角英数字、ピリオド（`.`）、ハイフン（`-`）、アンダースコア（`_`）を使用可能
- ピリオドは文字の間だけで使用でき、先頭・末尾・連続ピリオドは使用不可

パスワードはEdge Functionで暗号学的に安全な乱数を使って12文字で生成し、英大文字・英小文字・数字を最低1文字ずつ含めます。平文パスワードはDBへ保存せず、作成または再発行直後に一度だけ管理者へ表示します。

### 画面とアクセス制御

| ルート             | 対象               | 機能                                         |
| ------------------ | ------------------ | -------------------------------------------- |
| `/login`           | 未ログインユーザー | ユーザーID・パスワード認証                   |
| `/entry`           | ログインユーザー   | 回答の新規登録・更新                         |
| `/admin/users`     | 管理者             | ユーザー登録、パスワード再発行、ユーザー一覧 |
| `/admin/responses` | 管理者             | 回答確認、レビュー、ランキング、CSV出力      |

未ログイン時は `/login` へ、一般ユーザーが管理画面へアクセスした場合は権限エラーを表示して `/entry` へ移動します。フロントエンドの表示制御だけを認可には使わず、DB・Storage RLSとEdge Functionの管理者検証でも保護します。

### 回答入力

回答フォームでは以下を入力します。

- サーバー内ユーザーネーム：必須、1〜100文字
- ゲーム内プロデューサーネーム：必須、1〜100文字
- 育成キャラクター：`十王星南（sena）` または `雨夜燕（tsubame）`
- 応募部門：次の3部門から1つ選択
  - 無差別部門
  - スイッチカードOFF部門
  - 初心者部門（スイッチカードOFF必須）
- 評価値・最終所持スキルカード画像：任意。添付する場合は、評価値と最終所持スキルカードを同時に確認できる1枚を使用

初心者部門の参加条件は、イベント参加時点で「PLv60未満」または「ログイン日数合計90日以下」です。初心者部門を選択した場合に限り、PIDとPレベルの両方が分かる画像と、通知表の総出席日数が分かる画像を必須とします。各入力欄には提出画像のサンプルを表示します。

応募部門は最初の回答後に変更できません。画面で選択を無効化するだけでなく、保存処理は登録済みの値を維持し、DBトリガーも変更を拒否します。ユーザー名、育成キャラクター、回答画像は再送信で更新できます。

画像仕様：

- 1項目につき1ファイル
- 対応形式：JPG、JPEG、PNG、HEIC、HEIF
- 拡張子とMIMEタイプの両方を検証
- 最大10MB
- JPG・PNGは送信前プレビューを表示
- HEIC・HEIFはプレビューできない環境でもアップロード可能
- 画像を選び直さなければ既存画像を維持し、差し替え成功後は旧画像を削除

送信前には確認ダイアログを表示し、送信中は二重送信を防止します。画像アップロードまたはDB保存が失敗した場合は日本語のエラーを表示し、可能な限りアップロード済みファイルを回収します。

### ユーザー管理

管理者は `/admin/users` でユーザーIDを指定してユーザーを作成します。未登録の場合はAuthユーザーと一般ユーザーのプロフィールを作成し、生成したパスワードを一度だけ表示します。

登録済みの場合は新しいユーザーを作成せず、確認後にパスワードを再発行できます。再発行すると旧パスワードは使用不能になりますが、既存回答は維持されます。一覧にはユーザーID、権限、登録日時、回答済みか、最終回答日時を表示し、パスワードは表示しません。

### 回答管理

管理者は回答一覧について次の操作を行えます。

- ユーザー名、プロデューサー名、ユーザーIDによる部分一致検索
- 育成キャラクターと確認状態を独立して指定する絞り込み
- 最終更新日時、回答日時、確認済み評価値、ユーザー名による並び替え
- 提出されている評価値・最終所持スキルカード画像、初心者用PID・Pレベル画像、ログイン日数画像の確認
- 確認済み評価値、確認状態、管理者メモの編集
- 現在の検索・絞り込み結果をUTF-8 BOM付きCSVで出力

3種類の提出画像は「確認・編集」モーダル内で確認します。「評価値・最終所持スキルカード」画像が未提出でもモーダルと管理者メモは操作できますが、確認済み評価値と確認状態は編集できません。

管理項目は `submission_reviews` に保存し、一般ユーザーには公開しません。ランキングは確認済みかつ評価値入力済みの回答を対象に、育成キャラクター別で評価値の降順、同点時は最終回答日時の昇順に並べ、上位3名を強調します。

### セキュリティ要件

- Service Role Keyをフロントエンド、GitHub Pages成果物、DBへ含めない
- ユーザー作成とパスワード再発行はEdge Functionで実行する
- Edge FunctionはJWTとDB上のadmin権限をサーバー側で検証する
- PostgreSQLと非公開Storageバケットの両方でRLSを有効にする
- 一般ユーザーは自分のプロフィール、回答、Storageディレクトリだけへアクセスできる
- 管理者専用RPCは `security definer`、固定 `search_path`、限定した実行権限を使用する
- 内部メールアドレス、生のSupabaseエラー、SQL、秘密情報、スタックトレースを画面へ表示しない

### UI・品質要件

- 日本語UI、ダークテーマ、PC・スマートフォン対応
- 公式画像・ロゴなど権利上問題のあるゲーム素材は使用しない
- ラベル、項目別エラー、処理中表示、成功・失敗通知を省略しない
- キーボード操作とアクセシブルな独自モーダルに対応する
- VitestでID検証、画像検証、フォーム、パスワード、ランキングなどをテストする
- PRではlint・test・build、`main`へのpushではGitHub PagesとSupabaseをデプロイする

## システム構成

- React / TypeScript / Vite / React Router
- Supabase Auth（画面上はユーザーID、内部で `${userId}@app.invalid` に変換）
- Supabase PostgreSQL + Row Level Security
- Supabase Storage（非公開 `submission-images` バケット）
- Supabase Edge Functions（ユーザー作成・パスワード再発行）
- GitHub Actions / GitHub Pages

一般ユーザーは自分の回答と自分のStorageディレクトリだけにアクセスできます。管理者はDB上の `profiles.role` で判定され、全回答の閲覧、Signed URLによる画像確認、レビュー、CSV出力、ユーザー管理を行えます。

## ディレクトリ

```text
src/
  components/       共通ヘッダー、認証ガード、モーダル
  contexts/         セッションとプロフィール
  lib/              Supabase、検証、ランキング
  pages/            login / entry / admin users / admin responses
supabase/
  migrations/       DB・RLS・Storage・管理RPC
  functions/        create-user / reset-user-password
.github/workflows/  PR検証とPagesデプロイ
public/404.html      GitHub PagesのSPAフォールバック
```

## 1. 必要なサービス

- Docker DesktopまたはDocker Engine + Compose plugin
- Supabaseプロジェクト
- GitHubリポジトリ（Pages公開時）
- Supabase CLI（マイグレーション・Functionデプロイ時）

## 2. Supabaseプロジェクトの作成

Supabase Dashboardで新規プロジェクトを作成します。Authentication → Providers → Emailを有効にします。利用者へ実メールを送らない方式なので、本アプリが作成するユーザーはEdge Functionで `email_confirm: true` に設定されます。

Project Settings → APIからProject URLとAnon keyを控えます。Service Role KeyはEdge Function Secrets以外へコピーしないでください。

## 3. SQLマイグレーション

Supabase CLIでログインし、プロジェクトをリンクして適用します。

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

DashboardのSQL Editorを使う場合も、[マイグレーションディレクトリ](supabase/migrations/) のSQLをファイル名順にすべて実行してください。初期スキーマに加え、応募部門、初心者確認画像、ユーザーIDのピリオド対応が追加マイグレーションに含まれます。

## 4. Storage設定

マイグレーションが `submission-images` を非公開で作成し、10MB制限と対応MIMEを設定します。DashboardでバケットをPublicへ変更しないでください。

パスは `${auth.uid()}/score/${UUID}.ext`、初心者部門のみ `${auth.uid()}/beginner-proof/${UUID}.ext` と `${auth.uid()}/login-days-proof/${UUID}.ext` です。`deck` パスは旧形式の回答との移行互換性のためだけに残されています。RLSは所有者の作成・閲覧・更新・削除、管理者の閲覧だけを許可します。管理画面は5分間有効なSigned URLを発行します。

## 5. Edge Functionsのデプロイ

```bash
npx supabase functions deploy create-user
npx supabase functions deploy reset-user-password
```

両FunctionはAuthorization JWTを検証し、そのユーザーがDB上でadminかをサーバー側で確認します。

## 6. Edge Function Secrets

SupabaseがホストするFunctionでは通常 `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が自動提供されます。ローカル/明示設定が必要な環境では次を実行します（値はコミットしません）。

```bash
npx supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

## 7. 初期管理者

通常画面から管理者は作成しません。

1. Dashboard → Authentication → Users → Add userで、メールを `admin@app.invalid`、強い一時パスワードを指定し、Auto Confirm Userを有効にします。
2. 作成されたAuth UserのUUIDを控えます。
3. SQL Editorで次を実行します。

```sql
insert into public.profiles (id, user_id, role)
values ('AUTH_USER_UUID', 'admin', 'admin');
```

既存プロフィールを昇格する場合は、対象を十分確認してから次を実行します。

```sql
update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';
```

初回ログイン後、必要ならDashboardで管理者自身のパスワードを強いものへ更新してください。管理者IDにも正規化規則（3〜32文字、半角英小文字・数字・`.`・`-`・`_`）が適用されます。ピリオドは先頭・末尾・連続では使用できません。

## 8. ローカル開発

ホストへNode.jsやnpmパッケージをインストールする必要はありません。依存パッケージとビルド成果物はDockerの名前付きVolumeに保存されるため、作業ディレクトリに `node_modules` や `dist` は作成されません。

### ローカルバックエンド

Supabase CLI自体もコンテナで実行します。CLIコンテナがDockerソケットを通じて、PostgreSQL、Auth、Storage、Realtime、Edge Runtime、Studioなどの公式ローカルSupabaseコンテナを起動します。CLIが起動したPostgreSQLへlocalhostで接続するため、CLIコンテナだけはhostネットワークを使用します。Docker Desktopでは Settings → Resources → Network のHost networkingを有効にしてください。

```bash
docker compose --profile tools run --rm supabase start
```

初回は必要なDockerイメージのダウンロードに時間がかかります。起動時に表示される `Project URL` と `Publishable key` を `.env` に設定します。変数名はSupabase JavaScript SDKとの互換性のため `VITE_SUPABASE_ANON_KEY` のままですが、値には表示されたPublishable keyを使用できます。

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=起動結果に表示されたPublishable key
```

状態確認、DBの再構築、停止:

```bash
docker compose --profile tools run --rm supabase status
docker compose --profile tools run --rm supabase db reset
docker compose --profile tools run --rm supabase stop
```

`db reset` はローカルDBを削除して [マイグレーション](supabase/migrations/20260724000000_initial_schema.sql) を再適用します。本番Supabaseには影響しません。

Edge Functionsは `supabase start` によって起動されます。Functionsを単独でホットリロード開発する場合は、先に `supabase status` のSecret keyを `supabase/.env.local.example` からコピーした `supabase/.env.local` へ設定し、別ターミナルで実行します。これはローカル専用キーであり、本番のService Role Keyを使用しないでください。

```bash
cp supabase/.env.local.example supabase/.env.local
docker compose --profile tools run --rm --service-ports supabase functions serve --env-file supabase/.env.local
```

ローカル管理画面Supabase Studioは `http://localhost:54323`、受信メール確認画面Inbucketは `http://localhost:54324` です。

Docker Desktop for Macで標準以外のDockerソケットを使用している場合は、起動前に指定できます。

```bash
DOCKER_HOST_SOCKET="$HOME/.docker/run/docker.sock" docker compose --profile tools run --rm supabase start
```

### フロントエンド

```bash
cp .env.example .env
# supabase statusのProject URLとPublishable keyを.envへ設定
docker compose up --build
```

ブラウザで `http://localhost:5173` を開きます。終了は `Ctrl+C`、コンテナの停止は次のコマンドです。

```bash
docker compose down
```

品質チェックもすべてコンテナ内で実行します。

```bash
docker compose run --rm web npm run lint
docker compose run --rm web npm run test
docker compose run --rm web npm run build
```

短縮コマンドとして `npm run docker:lint` なども定義していますが、これらの短縮コマンド自体はホストのnpmを必要とします。ホストを完全にNode.js非依存にする場合は上記の `docker compose` コマンドを使用してください。

依存関係、`package.json`、TypeScript/Vite/ESLint設定を更新した場合は `docker compose up --build` でイメージを再構築します。`src` と `public` は個別にbind mountしているため、通常のコード編集にはホットリロードが働きます。ルート全体はmountしないので、Dockerがホストに空の `node_modules` や `dist` を作ることもありません。

Volumeを含めて完全に作り直す場合は `docker compose down --volumes` を実行してください。この操作はコンテナ内の依存関係とビルド成果物を削除しますが、ソースコードや `.env` は削除しません。

フロントエンドが使う環境変数は `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` だけです。Composeがホストの `.env` を読み、コンテナ環境へ渡します。[.env.example](.env.example) はローカルSupabase用、[.env.production.example](.env.production.example) はSupabase Cloud用のサンプルです。いずれもService Role Keyを含めてはいけません。

## 9. GitHub Variables / Secrets

リポジトリの Settings → Secrets and variables → Actions で設定します。

Variables:

- `VITE_SUPABASE_URL`
- `SUPABASE_PROJECT_ID`: Dashboard URLの `/project/` に続くProject Reference

Secrets:

- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_ACCESS_TOKEN`: Supabase Account → Access Tokensで発行
- `SUPABASE_DB_PASSWORD`: Supabaseプロジェクト作成時のDBパスワード

Anon keyは公開前提のキーですが、誤操作を減らすためSecretとして扱っています。Service Role KeyはGitHubへ登録せず、ビルドにも渡しません。

Settings → Environmentsで `production` 環境を作成してください。必要に応じてRequired reviewersやデプロイ対象ブランチを設定すると、DB変更とFunctionsデプロイの前に承認を要求できます。

## 10. GitHub Pages

Settings → Pages → Build and deployment → Sourceで **GitHub Actions** を選択します。`main` pushでlint・test・build後に自動デプロイされ、PRでは検証のみ行います。Viteは `GITHUB_REPOSITORY` からリポジトリ名を判定して `base` を設定します。

BrowserRouterを使用し、`public/404.html` が直接アクセスされたパスをSession Storageへ退避してSPAへ復元します。カスタムドメインなど公開パスを変える場合は404内のbase計算も確認してください。

## Supabaseの継続的デプロイ

[SupabaseデプロイWorkflow](.github/workflows/supabase-deploy.yml) は `supabase/` 配下の変更を対象にします。

- Pull Request: 新しいローカルDBへ全マイグレーションを適用し、DB lintとEdge Functionsの型検査を実行
- `main`へのpush: 上記検証後、未適用マイグレーションを本番DBへ反映
- DB反映成功後: `config.toml` に定義された全Edge Functionsを本番へデプロイ
- 手動実行: Actions画面の `Validate and deploy Supabase` から実行可能

本番デプロイは `supabase-production` concurrency groupにより直列化されます。複数マイグレーションが同時に本番へ適用されることはありません。失敗した場合はFunctionsへ進まず、既に適用済みのマイグレーションを自動的にロールバックもしません。修正用の新しいマイグレーションを追加してください。

一度この運用を開始したら、本番DashboardのSQL EditorやTable Editorで直接スキーマを変更しないでください。リモートのマイグレーション履歴とGit管理されたSQLが不一致になる原因になります。

## 11. 本番動作確認

- [ ] 未ログインで `/entry` と管理URLを開くとログインへ移動する
- [ ] 不正なID・パスワードで内部エラーや内部メールが表示されない
- [ ] 一般ユーザーが回答を新規登録・再編集できる
- [ ] 応募部門を3種類から選択でき、回答後は画面とDBの両方で変更できない
- [ ] 初心者部門でだけPID・Pレベル画像とログイン日数画像が必須になり、管理者が確認できる
- [ ] 画像を変更しない更新で既存画像が維持される
- [ ] 画像変更後に古いStorageオブジェクトが削除される
- [ ] 一般ユーザーが他人のDB行・画像・管理URLを閲覧できない
- [ ] 管理者がユーザーを作成でき、パスワードが一度だけ表示される
- [ ] 重複IDでは「登録済み」と再発行操作が表示される
- [ ] 再発行後、旧パスワードでログインできず既存回答は残る
- [ ] 管理者が画像を拡大・新規タブ表示できる
- [ ] レビュー保存、ランキング、検索、絞り込み、並び替えが動く
- [ ] CSVが現在の条件だけをUTF-8 BOM付きで出力する
- [ ] スマートフォンとキーボード操作で利用できる

RLSはDashboardのSQL Editorや別ユーザーのアクセストークンでも確認してください。

## 12. パスワードを再表示できない理由

パスワードは生成直後のEdge Functionレスポンスに一度だけ含まれます。DBへ平文保存せず、Supabase Authも復元可能な形では返しません。そのため閉じた後の再表示はできず、必要なら新しい値へ再発行します。この仕組みによりDBや管理一覧からパスワードが漏れる経路を作りません。

## 13. Service Role Keyをフロントエンドに置かない理由

Viteの `VITE_*` 値やGitHub Pagesの配信物は誰でも取得できます。Service Role KeyはRLSを迂回できるため、含めると全ユーザー・回答・画像に管理権限でアクセスされ得ます。本実装ではService Role KeyをSupabase Edge Function内だけで使用し、呼出元のJWTとadmin権限を毎回検証します。

## セキュリティと設計上の判断

- 認可の本体はフロントエンドではなくDB/Storage RLSとEdge Functionです。
- 一般ユーザーへ `submission_reviews` は一切公開しません。管理一覧の結合はadmin専用 `security definer` RPCです。
- `security definer` 関数は `search_path = ''` とスキーマ修飾を使い、実行権限をauthenticatedへ限定します。
- 回答保存前に新画像をアップロードし、DB失敗時は新画像を削除します。DB成功後に旧画像を削除するため、回答が存在するのに画像が先に消える順序を避けています。旧画像削除だけが失敗した場合は孤立ファイルが残り得るため、Storage監査で削除してください。
- HEIC/HEIFはブラウザ表示不能でもアップロードできます。拡張子とMIMEの双方、10MB制限をクライアントとStorageで検証します。
- CORSはGitHub Pagesのカスタムドメイン変更に対応できるよう `*` ですが、機密操作はBearer JWTとadmin確認で保護されています。運用ドメイン固定後は許可Originを絞ることも推奨します。
- CSVはブラウザ内で、表示中の検索・絞り込み結果から生成します。Signed URLや画像本体は含みません。

## 残り得る運用課題

- Storage旧画像削除の失敗を自動再試行するジョブはありません。
- 大人数運用時は管理RPCにページネーションを追加してください（ユーザー一覧は直近100件、回答一覧は現状全件）。
- GitHub PagesのURLが変わった場合、Supabase AuthenticationのSite URL / Redirect URLsも実際の公開URLに合わせてください。
