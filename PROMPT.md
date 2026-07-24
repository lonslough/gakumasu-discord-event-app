GitHub Pagesで公開する、学園アイドルマスターのイベント回答受付Webアプリを実装してください。

# 目的

Discordサーバー内で開催する「強化月間」イベントについて、参加者から応募情報とスクリーンショットを受け付ける。

ユーザーには管理者が発行したユーザーIDとランダムパスワードをDiscord経由で渡す。

参加者はログイン後、自分の回答を登録または上書きできる。

管理者は以下を行える。

* ユーザーの登録
* ユーザーのパスワード再発行
* 全回答の一覧表示
* 提出画像の確認
* 回答のCSV出力

# 技術構成

以下の構成を使用すること。

## フロントエンド

* React
* TypeScript
* Vite
* React Router
* GitHub Pages
* Supabase JavaScript SDK
* CSS Modulesまたは通常のCSS
* ESLint
* Prettier

UIライブラリの導入は必須ではない。

## バックエンド

Supabaseを使用する。

* Supabase Auth
* Supabase PostgreSQL
* Supabase Storage
* Supabase Edge Functions
* Row Level Security

GitHub Pagesは静的ホスティングとしてのみ使用する。

Service Role Keyなどの秘密情報をフロントエンドへ含めてはならない。

# 重要なセキュリティ要件

* パスワードをデータベースへ平文保存しない
* 発行済みパスワードを再表示しない
* ユーザー作成時に生成したパスワードは管理者へ一度だけ表示する
* 登録済みユーザーについては「登録済み」と表示する
* 登録済みユーザーのパスワードが必要な場合は、新しいパスワードを再発行する
* パスワード再発行後、以前のパスワードは使用不能にする
* ユーザーの作成とパスワード再発行はSupabase Edge Functionで実行する
* Supabase Service Role Keyをブラウザへ公開しない
* 管理者用Edge Functionは、ログインユーザーが管理者であることをサーバー側で検証する
* フロントエンド側の表示制御だけを認可として使用しない
* データベースとStorageの両方にRLSを設定する

# 認証方式

画面上では以下を入力させる。

* ユーザーID
* パスワード

Supabase Authでは内部的にメールアドレス＋パスワード認証を使用する。

ユーザーIDを次の形式の内部メールアドレスへ変換する。

```text
${normalizedUserId}@app.invalid
```

ユーザーIDは次の規則で正規化する。

* 前後の空白を除去
* 英字は小文字に変換
* 使用可能文字は半角英数字、ハイフン、アンダースコア
* 長さは3文字以上32文字以下
* 不正な文字が含まれる場合はエラー表示

内部メールアドレスは画面に表示しない。

# パスワード生成規則

管理者によるユーザー作成またはパスワード再発行時に、暗号学的に安全な乱数を使って12文字のパスワードを生成する。

以下を最低1文字ずつ含める。

* 半角英大文字
* 半角英小文字
* 数字

紛らわしい文字は除外してよい。

例：

* 大文字：ABCDEFGHJKLMNPQRSTUVWXYZ
* 小文字：abcdefghijkmnopqrstuvwxyz
* 数字：23456789

`Math.random()`は使用せず、Web Crypto APIまたはサーバー側の安全な乱数生成機能を使用する。

# 権限

ユーザーには以下の2種類の権限を持たせる。

* user
* admin

権限は`profiles`テーブルで管理する。

一般ユーザーは自分自身の回答のみ取得、作成、更新できる。

管理者は以下を実行できる。

* 全ユーザーの基本情報閲覧
* 全回答の閲覧
* 全画像の閲覧
* ユーザー作成
* パスワード再発行
* CSV出力

管理者であることは、必ずDBの権限情報またはAuthのカスタムクレームを使用して判定する。

# 画面構成

以下のルートを作成する。

```text
/login
/entry
/admin/users
/admin/responses
```

未ログイン状態でログイン以外のページへアクセスした場合は、`/login`へリダイレクトする。

一般ユーザーが管理画面へアクセスした場合は、`/entry`へリダイレクトし、権限がない旨を表示する。

GitHub PagesでReact Routerを使用できるように、SPA用の404対応またはHashRouterを採用する。

可能であればHashRouterではなくBrowserRouterを使用し、GitHub Pages向け404フォールバックを設定する。

# ログイン画面

入力項目：

* ユーザーID
* パスワード

ボタン：

* ログイン

機能：

* 入力値を検証する
* 認証中はボタンを無効化する
* ログイン失敗時は「ユーザーIDまたはパスワードが正しくありません」と表示する
* 内部メールアドレスやSupabaseの生のエラー内容は表示しない
* ログイン成功後は`/entry`へ遷移する

# 共通ヘッダー

ログイン後の画面には以下を表示する。

* アプリ名
* ログイン中のユーザーID
* 回答入力ボタン
* ログアウトボタン

管理者の場合のみ以下を追加表示する。

* ユーザー登録ボタン
* 回答結果表示ボタン

# 回答入力画面

ルート：

```text
/entry
```

フォーム項目：

## サーバー内ユーザーネーム

* 必須
* 1文字以上100文字以下

## ゲーム内プロデューサーネーム

* 必須
* 1文字以上100文字以下

## 応募部門

ラジオボタンで以下から1つを選択する。

* 十王星南
* 雨夜燕

必須項目とする。

内部的な値は以下とする。

```text
sena
tsubame
```

## 評価値画像

* 必須
* 1ファイルのみ
* 許可形式：jpg、jpeg、png、heic、heif
* MIMEタイプと拡張子の両方を検証する
* 最大ファイルサイズは10MB
* 画像以外は拒否する

## 最終デッキ画像

画面上の名称は「最終デッキ画像」とする。

説明として「メモリーのデッキが確認できる画像を添付してください」と表示する。

* 必須
* 1ファイルのみ
* 許可形式：jpg、jpeg、png、heic、heif
* MIMEタイプと拡張子の両方を検証する
* 最大ファイルサイズは10MB

HEICはブラウザによってプレビューできない場合があるため、プレビューできなくてもアップロードは可能にする。

JPGおよびPNGは、可能なら送信前プレビューを表示する。

# 回答済みデータの表示

ログインユーザーがすでに回答済みの場合、DBから回答を取得してフォームの初期値へ設定する。

初期表示するもの：

* サーバー内ユーザーネーム
* ゲーム内プロデューサーネーム
* 応募部門
* 現在登録されている画像のファイル名
* 現在登録されている画像のプレビューまたは確認リンク

画像を選択し直さなかった場合は、既存画像を維持する。

画像を選択し直した場合は、新しい画像で上書きする。

回答済みの場合、画面上部に次の注意書きを表示する。

```text
すでに回答が登録されています。再度送信すると、以前の回答が上書きされます。
```

# 送信確認ダイアログ

送信ボタン押下時、すぐに送信せず確認ダイアログを表示する。

新規回答の場合：

```text
この内容で回答を送信します。よろしいですか？
```

回答済みの場合：

```text
すでに登録されている回答を上書きします。以前の内容には戻せません。よろしいですか？
```

ボタン：

* 確認
* キャンセル

確認：

* 入力内容を検証する
* 画像をStorageへアップロードする
* 回答情報をDBへupsertする
* 成功時に完了メッセージを表示する

キャンセル：

* ダイアログを閉じる
* 入力内容を維持する

送信中は二重送信を防ぐ。

DB更新または画像アップロードの一部が失敗した場合、できる限り不整合が残らない処理にする。

# ファイル保存仕様

Supabase Storageに非公開バケットを作成する。

バケット名：

```text
submission-images
```

公開バケットにしてはならない。

ファイルパスは推測しにくく、ユーザーごとに分離する。

例：

```text
${authUserId}/score/${cryptoRandomUuid}.${extension}
${authUserId}/deck/${cryptoRandomUuid}.${extension}
```

StorageのRLSでは以下を実現する。

* 一般ユーザーは自分のディレクトリだけアップロード、閲覧、更新可能
* 他人のディレクトリは閲覧不可
* 管理者は全ファイルを閲覧可能

管理者画面で画像を表示する際は、短時間だけ有効なSigned URLを生成する。

回答を上書きして新しい画像を登録した場合、古い画像は削除する。

# ユーザー登録画面

ルート：

```text
/admin/users
```

管理者のみアクセス可能。

入力項目：

* ユーザーID

ボタン：

* 確認

送信後、Edge FunctionへユーザーIDを送る。

未登録の場合：

* Supabase Authユーザーを作成する
* `profiles`へ一般ユーザーとして登録する
* ランダムパスワードを生成する
* パスワードを一度だけ管理者画面へ返す
* 「新しいユーザーを登録しました」と表示する

表示内容：

* ユーザーID
* 発行したパスワード
* コピーボタン

パスワードを画面から閉じた後、再取得できる仕様にはしない。

登録済みの場合：

```text
このユーザーIDは登録済みです。
```

と表示する。

併せて「パスワードを再発行」ボタンを表示する。

パスワード再発行ボタン押下時は、次の確認ダイアログを表示する。

```text
パスワードを再発行すると、現在のパスワードではログインできなくなります。再発行しますか？
```

確認後：

* 新しいランダムパスワードを生成する
* Supabase Authのパスワードを更新する
* 新しいパスワードを一度だけ表示する
* 既存回答は削除しない

管理画面へ、最近登録したユーザー一覧も表示する。

一覧項目：

* ユーザーID
* 権限
* 登録日時
* 回答済みか
* 最終回答日時

パスワードは一覧に表示しない。

# 回答結果表示画面

ルート：

```text
/admin/responses
```

管理者のみアクセス可能。

画面上部に集計カードを表示する。

* 登録ユーザー数
* 回答者数
* 未回答者数
* 十王星南部門の回答数
* 雨夜燕部門の回答数

回答一覧をテーブル形式で表示する。

列：

* サーバー内ユーザーネーム
* ゲーム内プロデューサーネーム
* ログイン用ユーザーID
* 応募部門
* 評価値
* 評価値画像
* 最終デッキ画像
* 初回回答日時
* 最終更新日時
* 操作

評価値は画像から自動認識せず、管理者が入力できる項目として実装する。

回答テーブルまたは別の管理用テーブルへ、次の管理者専用項目を追加する。

* confirmed_score：確認済み評価値、nullable number
* verification_status：未確認、確認済み、無効
* admin_note：管理者メモ
* verified_at：確認日時
* verified_by：確認した管理者ID

管理者は一覧または詳細ダイアログから以下を編集できる。

* 確認済み評価値
* 確認状態
* 管理者メモ

一般ユーザーからこれらの管理用情報は見えないようにする。

# 一覧機能

回答結果画面へ以下を実装する。

## 検索

以下を部分一致検索できる。

* サーバー内ユーザーネーム
* ゲーム内プロデューサーネーム
* ログイン用ユーザーID

## 絞り込み

* 全部門
* 十王星南
* 雨夜燕
* 未確認
* 確認済み
* 無効

## 並び替え

* 最終更新日時
* 回答日時
* 確認済み評価値
* ユーザー名

評価値が未入力の場合は、評価値順で末尾へ配置する。

## 画像確認

各画像について以下を用意する。

* サムネイル
* 拡大表示
* 新しいタブで開く
* ファイル名表示

## CSV出力

現在の検索および絞り込み条件に該当する回答をCSVとしてダウンロードできるようにする。

CSVには画像本体を含めず、以下を含める。

* ユーザーID
* サーバー内ユーザーネーム
* ゲーム内プロデューサーネーム
* 応募部門
* 確認済み評価値
* 確認状態
* 管理者メモ
* 初回回答日時
* 最終更新日時

CSVはExcelで文字化けしにくいUTF-8 BOM付きとする。

# 回答のランキング表示

管理者画面内に部門別ランキングを表示する。

対象：

* verification_statusが`verified`
* confirmed_scoreが入力済み

順位条件：

1. confirmed_scoreの降順
2. 同点の場合は最終回答日時の昇順

部門ごとに上位3名を強調表示する。

このランキングは管理者のみ閲覧可能とする。

# データベース設計

必要に応じて改善してよいが、最低限以下のテーブルを作成する。

## profiles

```sql
id uuid primary key references auth.users(id) on delete cascade
user_id text unique not null
role text not null check (role in ('user', 'admin'))
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## submissions

```sql
id uuid primary key default gen_random_uuid()
user_id uuid unique not null references profiles(id) on delete cascade
discord_username text not null
producer_name text not null
category text not null check (category in ('sena', 'tsubame'))
score_image_path text not null
deck_image_path text not null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## submission_reviews

```sql
submission_id uuid primary key references submissions(id) on delete cascade
confirmed_score bigint null
verification_status text not null default 'pending'
  check (verification_status in ('pending', 'verified', 'invalid'))
admin_note text not null default ''
verified_at timestamptz null
verified_by uuid null references profiles(id)
updated_at timestamptz not null default now()
```

`updated_at`を自動更新するトリガーを作成する。

profilesへのAuthユーザー登録処理についても、Edge FunctionまたはDBトリガーで整合性を維持する。

# RLSポリシー

すべての対象テーブルでRLSを有効化する。

最低限、以下を実装する。

## profiles

一般ユーザー：

* 自分のプロフィールのみSELECT可能
* roleの変更不可

管理者：

* 全プロフィールをSELECT可能

## submissions

一般ユーザー：

* 自分の回答のみSELECT可能
* 自分の回答のみINSERT可能
* 自分の回答のみUPDATE可能
* 他ユーザーの回答は閲覧不可
* user_idを他人のIDに変更不可

管理者：

* 全回答をSELECT可能

## submission_reviews

一般ユーザー：

* SELECT、INSERT、UPDATE、DELETEすべて不可

管理者：

* SELECT、INSERT、UPDATE可能

管理者判定を再利用できるSQL関数を用意してよい。

その場合、再帰的なRLS評価にならないよう、安全な`security definer`関数として適切に実装する。

# Edge Functions

最低限、以下を実装する。

## create-user

入力：

```json
{
  "userId": "example-user"
}
```

処理：

* AuthorizationヘッダーのJWTを検証
* 呼び出し元がadminであることをDBで確認
* ユーザーIDを正規化、検証
* 既存ユーザーを検索
* 未登録の場合のみランダムパスワードを生成
* Supabase Admin APIでAuthユーザーを作成
* profilesへrole=`user`で登録
* 生成したパスワードをレスポンスで一度だけ返す

登録済みの場合はパスワードを返さず、既存であることを返す。

レスポンス例：

```json
{
  "status": "created",
  "userId": "example-user",
  "password": "Abcd2345Efgh"
}
```

または：

```json
{
  "status": "already_exists",
  "userId": "example-user"
}
```

## reset-user-password

入力：

```json
{
  "userId": "example-user"
}
```

処理：

* JWT検証
* admin権限検証
* 対象ユーザーの存在確認
* 新しいランダムパスワードを生成
* Supabase Admin APIでパスワードを変更
* 新しいパスワードを一度だけ返す

# 初期管理者の作成

最初の管理者は通常画面から作らず、セットアップ手順に従ってSupabase Dashboardまたは管理用SQLで作成する。

READMEへ具体的な作成手順を記載する。

初期管理者作成用SQLまたはスクリプトを用意する場合、秘密情報をリポジトリへコミットしないこと。

# UI・UX

* 日本語UI
* PCとスマートフォンの両方へ対応
* ダークテーマ寄りの見やすいデザイン
* 学園アイドルマスターの公式画像、ロゴ、ゲーム素材は使用しない
* 著作権上問題のない独自の装飾にする
* フォームのラベルを省略しない
* エラーは該当項目の近くへ表示する
* 処理中状態を表示する
* 成功通知、失敗通知を表示する
* キーボード操作に対応する
* 確認ダイアログはアクセシブルにする
* `window.alert`や`window.confirm`だけに頼らず、可能なら独自のモーダルコンポーネントを作る

# エラーハンドリング

ユーザー向けには分かりやすい日本語で表示する。

以下を個別に処理する。

* ログイン失敗
* セッション切れ
* 権限不足
* ファイル形式不正
* ファイルサイズ超過
* Storageアップロード失敗
* DB保存失敗
* 通信失敗
* ユーザーID重複
* パスワード再発行失敗

秘密情報、SQL、内部メールアドレス、スタックトレースを画面に表示しない。

# 環境変数

フロントエンドでは以下だけを使用する。

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

これらは公開されることを前提とし、RLSによってアクセスを制御する。

以下はSupabase Edge FunctionのSecretsとして設定する。

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Service Role KeyをGitHub Actionsのビルド成果物やフロントエンドコードへ含めてはならない。

# GitHub Pagesへのデプロイ

GitHub Actionsを使ってGitHub Pagesへデプロイする。

以下を考慮する。

* Viteの`base`設定
* リポジトリ名配下での公開
* SPAルーティング
* GitHub ActionsのPages権限
* mainブランチへのpushで自動デプロイ
* Pull Requestではビルドとテストのみ実行

# テスト

最低限、以下のテストを追加する。

* ユーザーID正規化
* ユーザーIDバリデーション
* ファイル拡張子検証
* MIMEタイプ検証
* ファイルサイズ検証
* 応募フォームのバリデーション
* パスワード生成結果が要件を満たすこと
* ランキングの並び順
* 同点時に回答時刻が早い方を上位にすること

可能ならVitestとReact Testing Libraryを使用する。

# 成果物

以下を作成する。

* 動作するReactアプリ
* Supabase用SQLマイグレーション
* StorageバケットとRLSの設定
* Edge Functions
* GitHub Actions
* `.env.example`
* README
* 初期管理者作成手順
* ローカル起動手順
* Supabaseセットアップ手順
* GitHub Pagesデプロイ手順
* セキュリティ上の注意事項
* 動作確認チェックリスト

# READMEへ必ず記載する内容

1. 必要なサービス
2. Supabaseプロジェクト作成方法
3. SQLマイグレーション適用方法
4. Storage設定方法
5. Edge Functionsのデプロイ方法
6. Edge Function Secretsの登録方法
7. 初期管理者の作成方法
8. ローカル開発方法
9. GitHub SecretsまたはVariablesの設定方法
10. GitHub Pagesの有効化方法
11. 本番環境の動作確認方法
12. パスワードを再表示できない理由
13. Service Role Keyをフロントエンドへ置いてはいけない理由

# 実装の進め方

最初に以下を提示すること。

1. システム構成
2. ディレクトリ構成
3. DB設計
4. RLS設計
5. Storage設計
6. Edge Function設計
7. 画面遷移
8. 実装順序

その後、計画だけで終了せず、実際にファイルを作成して実装を進めること。

不明な点については、安全性と保守性を優先して合理的な判断を行い、READMEへ判断内容を記録すること。

既存リポジトリにコードがある場合は、最初に現在の構成とpackage.jsonを確認し、既存コードを必要以上に破壊しないこと。

TypeScriptの型を適切に定義し、`any`の使用を避けること。

最後に以下を実行し、エラーがあれば修正すること。

```bash
npm install
npm run lint
npm run test
npm run build
```

最終報告には以下を含めること。

* 実装した機能
* 作成・変更した主要ファイル
* 手動で必要なSupabase設定
* 手動で必要なGitHub設定
* 残っている課題
* セキュリティ上の注意
