# RPC・Edge Functions設計

[索引](design-index.md) / [DB](data-model.md)

## クライアントからのアクセス

Supabase JS SDKを使用し、DB操作は認証セッションとRLS、Storage操作はバケットポリシーで制御します。主要な直接操作はprofilesの本人取得、event_editionsの一覧・作成・更新、submissionsの本人/開催回取得とupsert、submission_reviewsのupsertです。HTTP層を包む独自のRESTサーバーはありません。

## RPC

| RPC | 入力 | 戻り値・用途 |
| --- | --- | --- |
| get_event_settings | なし | active開催回のevent_id、event_name、rules_description、開始/終了、character_options、server_now、accepting_submissions。該当行なしはnull |
| list_my_submission_history | なし | 本人の参加済み全開催回の回答・開催回名/is_active/character_options・確認状態・確認済み得点・本人順位rank（number/null）のJSON配列。開催回作成日時/ID降順。0件は空配列 |
| get_my_rank_neighbor | p_event_id UUID（必須） | `{status, higher_score}`。本人の保存済み回答の直前順位の確認済み得点だけを返す。statusはranked / first / unranked / closed |
| list_public_ranking_events | なし | 公開回のid/name/is_active/character_options/created_atだけを作成日時降順で返すJSON配列。0件は空配列。認証必須 |
| get_public_rankings | p_event_id UUID（必須） | 公開回のcategory/entry_division/rank/discord_username/producer_name/confirmed_scoreだけを返すJSON配列。各キャラクター・部門の上位10名。認証必須 |
| is_submission_period_open | なし / p_event_id UUID | activeかつ開始以上・終了以下。null日時は制限なし、対象なしはfalse。引数なしはactiveへ委譲 |
| list_admin_submissions | p_event_id UUID（省略時active） | 回答・profile.user_id・reviewをJSON配列化、updated_at降順。非adminは空配列 |
| list_user_summaries | なし | プロフィールとhas_submission / last_submitted_at。登録日時降順、結合後100行。非adminは空配列 |
| count_registered_users | なし | role=userのプロフィール件数。非adminは0 |
| set_active_event | p_event_id UUID | void。adminと存在を確認し、現activeをfalse、対象をtrueに更新 |
| is_admin | check_user UUID（既定auth.uid()） | 指定プロフィールがadminか。RLS/関数から使用 |

管理一覧関数はエラーでなく空配列/0になる分岐があるため、UIガードとAPIの失敗条件は同一ではありません。set_active_eventはpage_images_pathを検査しません。画像の存在チェックは画面とactivate-event側です。

list_my_submission_historyはauthenticatedのみ実行可能なsecurity definer関数（search_path空）で、auth.uid()に一致する回答だけを取得します。user_idを受け取る引数はありません。管理者も本人分のみ。レビューなしはpending、confirmed_scoreはverifiedのときのみ返します。admin_note・verified_by・verified_atは含めません。回答の画像パスは本人分のみ返し、実体の取得には既存Storage RLSを適用します。[追加SQL](../supabase/migrations/20261006000000_add_submission_history.sql)

get_my_rank_neighborはauthenticatedのみ実行可能なsecurity definer関数（search_path空）。auth.uid()がnullなら42501で拒否します。p_event_idがnull・存在しない・非active・受付期間外ならclosedで得点はnull。期間判定は既存is_submission_period_openを使用し、開始・終了ちょうどを含みます。

本人の保存済み回答と同じ開催回・キャラクター・応募部門のverifiedかつ得点非nullを、得点降順・submissions.updated_at昇順に全件順位付けし、本人の直前の得点を返します。1位はfirst、未回答・ランキング対象外はunranked。ranked以外のhigher_scoreはnullです。任意のuser_id・キャラクター・部門は指定できず、管理者も本人基準です。名前・画像・順位一覧・管理者メモを含めず、既存RLSを緩和しません。[追加SQL](../supabase/migrations/20261020000000_add_entry_rank_neighbor.sql) / [DB検証](../supabase/tests/entry_rank_neighbor.sql)

## 公開ランキングの取得境界

上記2RPCはSECURITY DEFINER、search_path空。PUBLIC/anonの実行権限を取り消し、authenticatedにだけ付与します。auth.uid()がnullなら42501/authentication required。get_public_rankingsは非公開・不存在・引数nullも42501/ranking is not publishedで拒否します。管理者も公開APIの公開条件に従い、非公開回の確認・CSVには既存管理APIを使用します。

ランキングは公開条件を確認した回の現在の対象キャラクターだけを、verifiedかつconfirmed_score非nullで集計。category/entry_divisionごとに得点降順・submissions.updated_at昇順のrow_numberで順位を付け、10位までをサーバーで抽出します。0点も対象。同点は既存ランキングと同じ扱いで、同順位へのまとめはありません。返却順はcategory/entry_division/rank。公開された空回は空配列です。

公開は受付開始前・受付中・終了後・inactive回でも可能。公開取消は次回取得から拒否します。ログインID、回答ID、Auth ID、画像パス、管理者メモ、確認者、回答時刻を含めません。既存のテーブル・Storage RLS、本人限定の履歴/ポイントRPC、管理一覧RPCを緩めません。一般向け画面にはモックの確認用UIやメモリーアダプターは含まれません。[SQL](../supabase/migrations/20261123000000_add_public_rankings.sql) / [DB検証](../supabase/tests/public_rankings.sql) / [画面](screens/admin-responses.md)。

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

`requireAdmin` はservice_roleクライアントで呼出元JWTとprofiles.roleを検証します。create-user / reset-user-passwordにはそのクライアントを返し、activate-eventは `user` を指定して検証済み呼出元JWTをAuthorizationへ設定した別クライアントを取得します。開催回の読取・切替・直前activeへの復元は本人の認証情報で実行し、set_active_event内のis_admin()も本人を判定します。RPCの切替・復元失敗は詳細をサーバーログへ記録し、API応答は固定エラーコードを返します。

## 実装根拠

[DB関数](../supabase/migrations/20260816010000_add_event_editions.sql)、[初期RPC](../supabase/migrations/20260724000000_initial_schema.sql)、[共通認証](../supabase/functions/_shared/admin.ts)、[GitHub連携](../supabase/functions/_shared/github.ts)、[create-user](../supabase/functions/create-user/index.ts)、[reset-user-password](../supabase/functions/reset-user-password/index.ts)、[activate-event](../supabase/functions/activate-event/index.ts)、[page-images-archive](../supabase/functions/page-images-archive/index.ts)、[config.toml](../supabase/config.toml)。

## 参加履歴の本人順位（2026-11-23）

[list_my_submission_historyの更新](../supabase/migrations/20261123010000_add_submission_history_ranks.sql)はrankを追加します。同じ開催回・キャラクター・応募部門で、設定内キャラクターかつverified/得点非nullを得点降順・回答更新日時昇順のrow_numberで集計。順位は全件を対象とし、11位以下も返します。未確認・無効・得点なし・レビューなし・設定外キャラクターはnull。0点は対象です。

ranking_published・active・受付期間に依存せず本人だけへ返します。本人が参加した分類に集計を限定し、集計後にauth.uid()で本人の回答だけへ結合。既存の取得項目と本人限定・authenticated限定・search_path空・SECURITY DEFINERを維持し、他人の情報・管理メモを追加しません。認証UIDなしは従来どおり空配列、anonは実行権限なし。呼び出しごとの最新データを返し、順位固定保存は行いません。画面は1〜3位/ランク外/—に変換します。
