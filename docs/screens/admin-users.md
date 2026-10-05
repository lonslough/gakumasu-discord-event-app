# ユーザー登録画面

[索引](../design-index.md) / [API](../api.md) / [DB](../data-model.md)

## 目的・構成

`/admin/users`、admin専用。ユーザーIDから一般ユーザーのAuthアカウントとプロフィールを作成し、ランダムパスワードを発行します。権限昇格・削除UIはありません。

共通Headerにライト／ダークテーマの切替を表示します。端末連動と保存規則は[共通設計](../architecture.md)を参照します。

新しいユーザー欄、最近登録したユーザー一覧、ログイン情報モーダル、パスワード再発行確認モーダルで構成します。

## 作成・再発行

IDは入力時trim・小文字化、maxLength=32、validateUserIdで3〜32文字の英数字/ピリオド/ハイフン/アンダースコアを検査。「確認」でcreate-userへ `{userId}` を送信。入力下の補助文にはピリオドが列挙されていませんが、検証では許可しています。

未登録ならpasswordを含むレスポンスをモーダルへ表示し、入力をクリアして一覧を再取得。登録済みならalready_existsを表示し、再発行ボタンから確認モーダルへ進みます。確認するとreset-user-passwordを呼び、既存回答を保ったままAuthパスワードを更新します。

発行モーダルはID、パスワード、パスワードコピー、案内文コピーを表示。案内文はID・パスワード・固定URL `https://lonslough.github.io/gakumasu-server-event-app` を含みます。閉じるとcredentialを破棄し再表示できません。再発行でも共通モーダル内の「新しいユーザーを登録しました。」という文言が使われます。

## 一覧と失敗

list_user_summariesを初期表示と更新ボタン、成功後に呼びます。表示はID、role、登録日時、回答済み/未回答、最終回答日時。日時はja-JP表示。一覧中にパスワードは含みません。

初回のみloading表示があり、再取得時にloadingをtrueへ戻す処理はありません。取得失敗・登録失敗・再発行失敗は画面上部へ固定文言で表示します。Clipboard APIの失敗に専用catchはありません。

一覧RPCは開催回を絞らず回答を結合した後の100行です。複数開催回回答者の重複表示があり、表示件数は配列長です。「直近100名の一意な利用者」「現在開催回の回答状況」とは一致しません。

## 照合シナリオ（ソース確認）

- ID検証→新規発行／重複表示→確認付き再発行の分岐。
- モーダル終了時にcredentialを消去。
- コピー案内URLと一覧の開催回未分離を確認。

## 実装根拠

[UsersPage.tsx](../../src/pages/UsersPage.tsx)、[validation.ts](../../src/lib/validation.ts)、[初期一覧RPC](../../supabase/migrations/20260724000000_initial_schema.sql)、[create-user](../../supabase/functions/create-user/index.ts)、[reset-user-password](../../supabase/functions/reset-user-password/index.ts)。
