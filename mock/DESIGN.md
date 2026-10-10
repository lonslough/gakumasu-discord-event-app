# Mockの設計・検証

基準main: 3bee133db0a01f3c607cf0305a147fbae135af87。全画面は source/src/pages/、共通画面は source/src/components/ に抽出しています。本番srcの仕様正本は [設計索引](../docs/design-index.md) です。mockの差分は本書とREADMEへ記載します。

|画面|mainの正本|mockでの差分|
|---|---|---|
|ログイン|[login](../docs/screens/login.md)|6名から選択。パスワードdisabled。初期ユーザーuser1。テーマはメモリーのみ|
|回答入力|[entry](../docs/screens/entry.md)|受付設定・本人回答・画像をメモリーから取得／更新|
|参加履歴|[history](../docs/screens/history.md)|本人の現在／過去回回答。未確認／無効の得点と管理者メモは非表示|
|ユーザー登録|[users](../docs/screens/admin-users.md)|メモリー内で登録、発行値はMOCK-PASSWORD。ログイン選択肢へ追加|
|回答結果|[responses](../docs/screens/admin-responses.md)|初期回答4件。検索・ランキング・CSV・レビュー更新は既存UI。管理者専用|
|設定|[settings](../docs/screens/admin-settings.md)|開催回・ルール・期間・2名のキャラ・ページ画像・受付切替をメモリーへ反映|

永続化を実装するモジュールはsupabase.ts/theme.ts/localPageImages.ts/siteConfig.tsを置換しています。画像変換はmainのライブラリーを同梱し、圧縮の外部Worker取得を無効化しています。画像ZIP・提出画像はBlobとして保持。HTTP配信ではHashRouter、file起動ではMemoryRouter。旧admin/rulesの転送と権限ガードはmainのRoutes.tsxを使用しています。

## 検証（2026-10-10）

配布JS/CSSのesbuild成功。配布JSをJSDOMで実行し、LocalStorage/SessionStorage/IndexedDB/Cache API/Cookie/Fetch/XMLHttpRequestへのアクセスを例外にする検査で呼出し0件。

- 初期6名、パスワード無効、一般ユーザーと管理者のログイン、全6画面を確認。
- 一般ユーザーの管理ルート拒否、本人履歴だけの表示、過去回と確認済み得点を確認。
- 管理者レビュー更新、開催名の保存と回答画面への反映、追加ユーザーのログインを確認。
- user5の必須入力エラー、回答保存、履歴への反映、ログアウト後の保持、管理一覧への反映を確認。
- 新しいDOMで同じJSを実行し、ログイン・アカウント数・開催名が初期状態へ戻ることを確認。
- file://起動でログイン、履歴、管理設定へのリンク遷移を確認。

実ブラウザーは接続先なしのため未実施。PC／スマートフォンの見た目、画像選択・圧縮・切抜き、CSVダウンロード、Clipboard操作は実ブラウザーでの検証保留です。DOM検証をブラウザー手動テスト済みとして扱いません。通常アプリのDB/RLS/CIテストはこの独立mockの検証対象外です。

## 開催回追加（2026-10-10）

開催回を2回から6回（現在1回・過去5回）へ増加。対象2名は全6回で重複しない12名を使用し、対応表はREADMEへ記載。第6回を初期受付対象にする。現在回4回答と、過去各回2回答（user1/user2）、計14回答をメモリーに生成。過去回答のキャラクターと日時は所属回へ合わせる。全回にページ画像のメモリーZIPを用意。

配布成果物を再ビルドし、DOMで全6回の回答結果・設定の対象キャラ、画像読込、受付対象切替後の入力キャラ、user1の履歴6行を検証して成功。永続化・Cookie・通信を禁止した環境で呼出し0件。実ブラウザーの表示確認は接続先なしのため引き続き保留。
