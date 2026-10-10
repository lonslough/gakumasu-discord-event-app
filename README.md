# 強化月間イベント回答受付アプリ

Discordサーバー内イベントの応募情報と画像を、開催回ごとに受け付けるアプリです。参加者の回答登録・更新と、管理者によるユーザー発行・回答確認・ランキング・開催回設定に対応します。

React / TypeScript / Viteで画面を構築し、認証・DB・画像保存にはSupabase、公開にはGitHub Pagesを使用します。

## ローカル起動

DockerとComposeを用意し、このリポジトリのルートで実行します。Docker DesktopではHost networkingを有効にしてください。

```bash
docker compose up --build
```

`http://localhost:5173` を開きます。ローカルSupabaseも起動するため、通常はホストのNode.jsや`.env`設定は不要です。

ローカル検証用アカウントは管理者 `test` / `test`、一般ユーザー `user` / `user`（ID / パスワード）です。本番では使用しません。

### テストデータ（Seeder）

`supabase/seed.sql` はローカルDBの初回作成時とリセット時に適用されます。既存環境に適用する場合：

```bash
docker compose exec backend supabase db reset --local
```

**既存のローカルDBデータは消去されます。** Seederの単独再実行・本番適用は想定していません。

- `user` / `user`：6開催回の参加履歴。確認済み（123,456点）、確認待ち、対象外、0点、得点未登録、レビュー未作成を確認できます。
- `test` / `test`：管理画面で同じ回答を確認できます。本人の参加履歴は空なので、空表示も確認できます。
- 最新のサンプル開催回が受付中です。一般部門・スイッチOFF部門と2キャラクターを含みます。
- 画像は未提出です。画像表示や初心者部門の証明画像は、画面から実際にアップロードして確認してください。

停止：

```bash
docker compose down
```

環境設定・DB管理・本番公開は [運用設計とセットアップ](docs/operations.md) を参照してください。

## 開発の進め方

このリポジトリをCodexの作業対象として開き、専用スキルに短い要望を渡します。

```text
$gakumasu-dev 回答一覧に応募部門の絞り込みを追加したい
```

[gakumasu-devスキル](.agents/skills/gakumasu-dev/SKILL.md) は次の順に進めます。

1. 一時仕様書を作成し、決定事項の件数を提示して対話で仕様を確定。
2. 一時設計書を作成し、実装。
3. AIがブラウザーで手動テストし、仕様との不一致を修正・再確認。
4. 検証後に`docs`の画面別・共通設計書を更新。

手動テストができない場合は検証保留として報告します。スキルを使わない開発でも、設計書で影響範囲を確認し、実装・検証・設計書更新を一緒に行ってください。デプロイは別途指示がある場合に実施します。

品質チェック：

```bash
docker compose run --rm --no-deps web npm run lint
docker compose run --rm --no-deps web npm run test
docker compose run --rm --no-deps web npm run build
```

## ドキュメント

- [設計書の索引](docs/design-index.md)：全5画面、共通構成、DB、API、画像処理の正本設計書
- [運用設計](docs/operations.md)：開発環境、初期設定、CI/CD、品質チェック
- [設計書の照合記録](docs/verification.md)：実装との照合結果と確認範囲

現行実装を基準に設計書を保守します。`PROMPT.md`・`PROMPT2.md`は過去の要件資料です。

## フロントエンドmock

永続化・バックエンド通信なしの画面確認用mockは [mock/README.md](mock/README.md) を参照してください。mock/index.htmlを開き、user1〜user5またはadminを選択してログインできます。
