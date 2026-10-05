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

[LoginPage.tsx](../../src/pages/LoginPage.tsx)、[ThemeToggle.tsx](../../src/components/ThemeToggle.tsx)、[validation.ts](../../src/lib/validation.ts)、[AuthContext.tsx](../../src/contexts/AuthContext.tsx)、[siteConfig.ts](../../src/lib/siteConfig.ts)。
