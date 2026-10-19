# アプリケーション設計書（正本）

本書群は `gakumasu-server-event-app` の現行ソースとSQLマイグレーションを基準にした設計書です。旧要件より実装を優先し、未実装の改善案を現在の動作として扱いません。作成日：2026-10-04。稼働中のDB・本番設定は調査対象外です。

## 読み方とディレクトリ

```text
docs/
  design-index.md           索引・正本の管理ルール
  architecture.md           構成・認証・画面遷移・共通UI
  data-model.md             テーブル・制約・RLS・DBトリガー
  api.md                    RPC・Edge Functions・認証境界
  images.md                 提出画像・ページ画像・キャッシュ
  operations.md             開発環境・環境変数・CI/CD・既存テスト
  screens/
    login.md
    entry.md
    history.md
    admin-users.md
    admin-responses.md
    admin-settings.md
  verification.md           3回の実装照合記録と確認範囲
```

| 調べる内容 | 設計書 |
| --- | --- |
| 全体構成・認証・共通UI | [architecture.md](architecture.md) |
| DB・制約・権限 | [data-model.md](data-model.md) |
| API契約 | [api.md](api.md) |
| 圧縮・Storage・公開画像 | [images.md](images.md) |
| 起動・配信・品質チェック | [operations.md](operations.md) |
| 照合結果と検証の限界 | [verification.md](verification.md) |

## 全ルートと画面設計

| ルート | 対象 | 設計書 |
| --- | --- | --- |
| `/login` | 未ログイン。ログイン済みは回答入力へ | [ログイン](screens/login.md) |
| `/entry` | ログインユーザー（管理者も可） | [回答入力](screens/entry.md) |
| `/history` | ログインユーザー（管理者も本人分のみ） | [参加履歴](screens/history.md) |
| `/admin/users` | 管理者 | [ユーザー登録](screens/admin-users.md) |
| `/admin/responses` | 管理者 | [回答結果](screens/admin-responses.md) |
| `/admin/settings` | 管理者 | [設定](screens/admin-settings.md) |
| `/admin/rules` | 管理者。設定画面へ転送 | [設定](screens/admin-settings.md) |
| `*` | `/entry` へ転送後、認証ガードを適用 | [共通ルーティング](architecture.md) |

モーダルは所属画面の設計書に記載します。画面を追加・削除した場合はこの表も更新します。

2026-10-20: 回答入力に本人の1つ上の順位のポイント表示と限定RPCを追加。全6画面・旧URL・未定義URLの対応は既存Routes.tsxと照合し、ルート追加・変更はありません。自動検査・ローカルDB/APIは確認済み、実ブラウザーによる描画・手動操作は保留です。[検証記録](verification.md)を参照してください。

## 開発スキルからの参照

[gakumasu-dev](../.agents/skills/gakumasu-dev/SKILL.md) はこの索引から共通設計と対象画面を読み、データ変更時はdata-model.mdとapi.md、画像変更時はimages.mdを参照します。現在の配置はスキル内の正本設計書規約に一致します。

変更時は実装→該当画面→共通設計→索引の整合を確認し、同じ仕様を別の正本に複製しません。各文書の「実装根拠」から実ファイルへたどれます。一時仕様書・一時設計書はdocsへ混在させません。文書だけを整備する依頼では、アプリの新機能実装・デプロイを開始する必要はありません。

画面別の「照合シナリオ」はソース上の分岐確認です。ブラウザー手動テストの実施記録とは区別します。起動方法の利用者向け説明は[リポジトリREADME](../README.md)を参照してください。

## 永続化しないフロントエンドmock

main由来の独立した画面確認用mockは [mock/README.md](../mock/README.md) を参照してください。全6画面との対応・mock固有の差分・検証保留事項は [mock/DESIGN.md](../mock/DESIGN.md) にまとめています。
