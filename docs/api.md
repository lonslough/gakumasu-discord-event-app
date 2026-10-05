# RPC・Edge Functions設計

[索引](design-index.md) / [DB](data-model.md)

## クライアントからのアクセス

Supabase JS SDKを使用し、DB操作は認証セッションとRLS、Storage操作はバケットポリシーで制御します。主要な直接操作はprofilesの本人取得、event_editionsの一覧・作成・更新、submissionsの本人/開催回取得とupsert、submission_reviewsのupsertです。HTTP層を包む独自のRESTサーバーはありません。

## RPC

| RPC | 入力 | 戻り値・用途 |
| --- | --- | --- |
| get_event_settings | なし | active開催回のevent_id、event_name、rules_description、開始/終了、character_options、server_now、accepting_submissions。該当行なしはnull |
| is_submission_period_open | なし / p_event_id UUID | activeかつ開始以上・終了以下。null日時は制限なし、対象なしはfalse。引数なしはactiveへ委譲 |
| list_admin_submissions | p_event_id UUID（省略時active） | 回答・profile.user_id・reviewをJSON配列化、updated_at降順。非adminは空配列 |
| list_user_summaries | なし | プロフィールとhas_submission / last_submitted_at。登録日時降順、結合後100行。非adminは空配列 |
| count_registered_users | なし | role=userのプロフィール件数。非adminは0 |
| set_active_event | p_event_id UUID | void。adminと存在を確認し、現activeをfalse、対象をtrueに更新 |
| is_admin | check_user UUID（既定auth.uid()） | 指定プロフィールがadminか。RLS/関数から使用 |

管理一覧関数はエラーでなく空配列/0になる分岐があるため、UIガードとAPIの失敗条件は同一ではありません。set_active_eventはpage_images_pathを検査しません。画像の存在チェックは画面とactivate-event側です。

## Edge Functions共通

create-user、reset-user-password、activate-eventのハンドラーはOPTIONSへ200、POST以外へ405。AuthorizationのBearer JWTをauth.getUserで検証してprofiles.role=adminを確認し、設定不足・JWT不足・非管理者等は403を返します。config.tomlでもこの3つのverify_jwt=trueのため、ゲートウェイで先に拒否された場合の応答はこのハンドラーの定義とは別です。

共通jsonヘルパーのレスポンスはJSON、CORS originは `*`。OPTIONSへの応答本文は `ok` です。ユーザー向け画面はAPIのerrorコードをそのまま表示せず固定日本語文言に変換します。

| Function | 入力 | 成功 | 主な失敗 |
| --- | --- | --- | --- |
| create-user | `{userId:string}` | `{status:'created',userId,password}` または `{status:'already_exists',userId}` | 400 invalid_request / invalid_user_id、500 create_failed |
| reset-user-password | `{userId:string}` | `{status:'reset',userId,password}` | 400入力エラー、404 not_found、500 reset_failed |
| activate-event | `{eventId:string}` | `{status:'deploying'}` / `{status:'activated_locally'}` | 400 invalid_request、409 page_images_required、500 activate_failed、502 deploy_trigger_failed |
| page-images-archive | GET、X-Deploy-Secretヘッダー | `{signedUrl:string}`、900秒有効 | 405 method_not_allowed、403 forbidden、503 not_configured、404 archive_not_configured、500 archive_unavailable |

create-userはIDをtrim・小文字化し、3〜32文字の英数字/ピリオド/ハイフン/アンダースコアを検証。profilesで重複を検出したらパスワードは発行しません。新規はAuthをemail_confirm=trueで作成し、profiles作成失敗時はAuth削除を試みます。resetはprofilesからAuth UUIDを引き、Authのパスワードだけを変更します。

内部メールは通常 `normalizedUserId@app.invalid`。メールローカル部として不適切なピリオド配置等は `u+<base64url>@app.invalid` とします。パスワードはサーバーで12文字を生成し、大文字・小文字・数字を最低1文字ずつ含め、crypto乱数の棄却法とシャッフルを使用します。フロントのpassword.tsはテストされる補助実装で、発行画面はFunctionが返す値を使用します。

## 開催回切替とPages連携

activate-eventはeventIdを36文字の16進文字/ハイフンの正規表現で検査し、対象開催回のpage_images_pathと直前activeを取得。set_active_event RPC成功後、SUPABASE_URLがlocalhost / 127.0.0.1 / host.docker.internal / kongに該当するとローカル成功を返します。

それ以外はGitHub AppのRS256 JWTを作り、Installation Tokenを取得して `actions/workflows/deploy.yml/dispatches` を呼びます。GITHUB_PAGES_BRANCHの既定はmain。鍵はPKCS#8、エスケープされた改行も復元します。起動要求の失敗時のみ、直前activeがあれば復元を試みて502を返します。Workflow完了の監視・後続失敗時の復元はありません。

page-images-archiveだけはverify_jwt=falseで、PAGE_DEPLOY_SECRETとX-Deploy-Secretの一致を要求します。service_roleクライアントでactive開催回を取得し、page-imagesのZIPへ署名URLを発行します。管理者JWTで認証するエンドポイントではありません。

`requireAdmin` が返すクライアントはservice_roleキーで作成され、呼出元JWTをクライアントのAuthorizationとして設定していません。一方set_active_event内は引数なしis_admin()を使用します。この組み合わせの実環境での成功は今回未検証であり、呼出元がadminなら必ずRPCも成功すると断定しません。

## 実装根拠

[DB関数](../supabase/migrations/20260816010000_add_event_editions.sql)、[初期RPC](../supabase/migrations/20260724000000_initial_schema.sql)、[共通認証](../supabase/functions/_shared/admin.ts)、[GitHub連携](../supabase/functions/_shared/github.ts)、[create-user](../supabase/functions/create-user/index.ts)、[reset-user-password](../supabase/functions/reset-user-password/index.ts)、[activate-event](../supabase/functions/activate-event/index.ts)、[page-images-archive](../supabase/functions/page-images-archive/index.ts)、[config.toml](../supabase/config.toml)。
