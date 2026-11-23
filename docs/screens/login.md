# ログイン画面

[索引](../design-index.md) / [共通認証](../architecture.md) / [API](../api.md)

## 目的・経路

`/login`。管理者が発行したIDとパスワードでSupabase Authへログインします。既存セッションがあれば `/entry` へreplace。共通Headerは表示しません。

## UIと検証

| 項目 | 挙動 |
| --- | --- |
| ページ画像 | useSiteConfigのloginImage。代替テキストは十王星南・雨夜燕の固定文言 |
| タイトル | 強化月間エントリー、SERVER EVENT 2026は固定表示 |
| ユーザーID | maxLength=32、入力ごとにtrim・小文字化、autocomplete=username |
| パスワード | 必須、password入力、autocomplete=current-password |
| ログイン | 認証中またはSupabase設定不足でdisabled |
| テーマ切替 | 右上でライト／ダークを手動切替。端末連動と保存規則は共通設計を参照 |

IDは3〜32文字、半角英数字・ピリオド・ハイフン・アンダースコア。validateUserIdを通過後、内部メールへ変換してsignInWithPasswordへ渡します。

## 状態と失敗

入力→検証→submitting=true→Auth呼出→成功時 `/entry`、失敗時「ユーザーIDまたはパスワードが正しくありません。」。ID不正・空パスワードは通信前に文言を表示。Supabase環境変数不足時は専用警告。エラー表示はrole=alertです。

元のアクセス先への復帰、自己登録、パスワード再設定フォームはありません。ユーザー作成・再発行は[ユーザー登録画面](admin-users.md)から実行します。

## 照合シナリオ（ソース確認）

- 不正なID／空パスワードはAuthを呼ばない。
- Authエラーを内部メールや生のエラーへ置き換えず固定文言で表示。
- 成功後と既存セッションでのアクセスは常に回答入力へ遷移。
- 設定不足時はログインボタンが無効。

## 実装根拠

2026-11-23再照合: ログインフォーム・成功時のentry転送は維持。未認証のランキングURLもログインへ転送され、ログイン後は既存同様entryへ移動します。認証後Headerの「ランキング」から公開回を閲覧できます。ルートテストとローカルAuth HTTPを確認、実ブラウザー手動操作は保留。[検証記録](../verification.md)。

[LoginPage.tsx](../../src/pages/LoginPage.tsx)、[ThemeToggle.tsx](../../src/components/ThemeToggle.tsx)、[validation.ts](../../src/lib/validation.ts)、[AuthContext.tsx](../../src/contexts/AuthContext.tsx)、[siteConfig.ts](../../src/lib/siteConfig.ts)。

## ページ画像の読み込み状態（2026-11-23）

画像設定の解決・画像取得・デコード完了まで画像欄内にスピナーのみ表示します。取得・デコード失敗は静止スケルトンに切り替えます。確定前の既定画像や前の画像を一瞬表示せず、画像の準備中もフォーム操作は利用できます。ログインの既存useLoginLayoutと回答入力バナーの比率は維持します。共通処理は[PageImageState.tsx](../../src/components/PageImageState.tsx)、取得・キャッシュは[画像設計](../images.md)を参照してください。

共通状態テストと全画面の既存テストは成功。PC/スマホ・ライト/ダークの実描画はブラウザー接続不能のため保留です。[検証記録](../verification.md)。

2026-11-23 履歴順位追加時の全画面照合: LoginPageの認証・テーマ・画像状態、ログイン後/認証済み転送の現状を照合。履歴順位追加による画面変更はありません。 全152テストで既存の画面/ルートを回帰確認。ブラウザー実描画・全画面手動操作は保留。[検証記録](../verification.md)。


2026-11-24 全画面再照合: LoginPageの認証・画像状態・フォーム配置とログイン後/未ログイン遷移を照合。部門設定はこの画面では編集せず、既存のログインと画像ロード処理を維持。 全173テストで既存ルートと関連処理を回帰確認。実ブラウザーでの手動操作・描画は未確認。[検証記録](../verification.md)。


2026-11-24 v13全画面再照合: ログイン後の回答入力で単一部門の自動選択が加わりました。ログイン画面の認証・画像読込・ログイン後転送は維持。 全178テスト・lint/build成功。実ブラウザーでの手動操作・描画は未確認。[検証記録](../verification.md)。
