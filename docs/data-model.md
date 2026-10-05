# データモデル・DB制御

[索引](design-index.md) / [API](api.md) / [画像](images.md)

以下は全マイグレーション適用後の定義です。DB接続による本番スキーマ照合は実施していません。UUID主キーとtimestamptzを使用し、主要テーブルのupdated_atは更新前トリガーでnow()へ更新します。

## テーブル

### profiles

| カラム | 型・制約・意味 |
| --- | --- |
| id | UUID PK。auth.users.idを参照、Auth削除時cascade |
| user_id | text、必須・一意、3〜32文字、小文字英数字と `. _ -` |
| role | text、user / admin、既定user |
| created_at / updated_at | timestamptz、必須、既定now() |

入力時はtrim・小文字化。ピリオドは先頭・末尾・連続も可。パスワードはこのテーブルに保存しません。

### event_editions

| カラム | 型・制約・意味 |
| --- | --- |
| id | UUID PK、gen_random_uuid() |
| name | text、trim後1〜100文字 |
| rules_description | text、既定空、最大10,000文字 |
| submission_start_at / submission_end_at | nullable timestamptz、両方あるときstart < end |
| character_options | 必須jsonb配列、異なる許可IDを2つ保持 |
| is_active | boolean、既定false、true行は部分一意indexで最大1行 |
| page_images_path | nullable text、値があるなら `id/page-images.zip` に一致 |
| created_at / updated_at | 必須timestamptz、既定now() |
| updated_by | nullable UUID、profiles参照 |

キャラクター項目のアプリ型は `{id,name,shortName,enabled}`。DBトリガーは配列の長さ・IDの重複・許可IDを検査し、name/shortName/enabledの完全なJSONスキーマ検証ではありません。13名のIDはsaki、temari、kotone、mao、lilja、china、sumika、hiro、rinami、ume、misuzu、sena、tsubame。

初期移行は旧event_settingsから「第1回」を作成し、既存回答をその開催回へ関連付けます。管理画面に開催回削除操作はありません。

### submissions

| カラム | 型・制約・意味 |
| --- | --- |
| id | UUID PK、gen_random_uuid() |
| event_id | 必須UUID、event_editions参照 |
| user_id | 必須UUID、profiles参照、プロフィール削除時cascade |
| discord_username / producer_name | 必須text、それぞれ1〜100文字。アプリ保存時trim |
| category | 必須text、開催回キャラクターID |
| entry_division | open / switch_off / beginner、既定open、登録後変更禁止 |
| score_image_path | nullable text、本人UUIDの `/score/` 配下 |
| deck_image_path | nullable text、本人UUIDの `/deck/` 配下、旧形式専用 |
| beginner_proof_image_path | nullable text、本人UUIDの `/beginner-proof/` 配下 |
| login_days_proof_image_path | nullable text、本人UUIDの `/login-days-proof/` 配下 |
| created_at / updated_at | 必須timestamptz、既定now() |

一意キーは `(event_id,user_id)`。beginnerは2種類の証明画像パスが必須。`beginner_evidence_required` はNOT VALIDで追加されており、既存行の全件検査を済ませた宣言ではありません。新規・更新行には制約を適用します。画像パスはStorageオブジェクトへの外部キーではなく文字列制約です。

### submission_reviews

| カラム | 型・制約・意味 |
| --- | --- |
| submission_id | UUID PK、submissions参照、回答削除時cascade |
| confirmed_score | nullable bigint、0以上 |
| verification_status | pending / verified / invalid、既定pending |
| admin_note | 必須text、既定空、最大1,000文字 |
| verified_at / verified_by | nullable timestamptz / profiles参照UUID |
| updated_at | 必須timestamptz、既定now() |

レビュー行がない回答はUIで未確認扱いです。DBはverifiedに評価値必須という制約を設けていません。UIのランキングもverifiedかつscore非nullを別条件として判定します。

### event_settings（旧設定）

booleanのid=trueを主キーとする単一行。rules_description、updated_at、updated_by、開始・終了日時、character_optionsを保持します。テーブルと読取・管理者更新ポリシーは残っていますが、現行画面とget_event_settingsはevent_editionsを使用します。

## 回答に関するDBトリガー

| 処理 | タイミングと挙動 |
| --- | --- |
| prevent_entry_division_change | entry_division更新前、値が変われば例外 |
| reject_submission_outside_period | INSERT/UPDATE前、対象event_idが非activeまたは期間外なら例外 |
| validate_submission_character | INSERTまたはcategory/event_id更新前、開催回にIDが存在するか検査。UPDATEでcategoryが同じ場合は早期return |
| reject_reviewed_submission_image_change | 4画像パス更新前、パス差分がありレビューがpending以外なら例外 |
| reset_submission_review_on_submission_change | category/score/deckに実差分のあるUPDATE後、score・確認日時・確認者をnull、状態をpending。メモは保持 |

初心者証明だけの差分や名前だけの差分はレビューリセット対象外です。画像パスの保護はレビュー未作成の場合にも更新を許可します。categoryの検査は現在の開催回のID存在を確認し、enabledによる検査ではありません。

## RLSとSQL権限

| 対象 | SELECT | INSERT / UPDATE | DELETE |
| --- | --- | --- | --- |
| profiles | 本人またはadmin | 一般クライアント向けポリシーなし。作成はFunction | UIなし |
| submissions | 本人またはadmin | 本人分のみ、DB制約・トリガーも適用 | UI・許可ポリシーなし |
| submission_reviews | admin | admin | UI・許可ポリシーなし |
| event_editions | authenticated全員 | admin | UI・許可ポリシーなし |
| event_settings | authenticated全員 | UPDATEはadmin | UIなし |

anonから主要テーブルへの権限を取り消します。is_adminはprofiles.roleを確認するsecurity definer関数。管理RPCはadmin判定を内部で行います。service_roleへのprofiles SELECT/INSERT付与はユーザー作成用の追加migrationにあります。Storageの最終ポリシーは[画像設計](images.md)を参照。

## 現行挙動の注意点

- list_user_summariesは全開催回の回答をuser_idのみで結合するため複数行になり、結合後100行に制限されます。
- キャラクター変更後も既存回答のcategoryは自動移行しません。同じcategoryの再保存は検査が早期returnします。
- set_active_eventはauthenticatedに実行権限があり、内部adminチェックがあります。最終migrationにローカル環境だけへ限定する条件はありません。
- 管理者でも通常のsubmissions更新ポリシーは本人分のみです。他人の回答内容を直接編集する管理UIはなく、管理操作は別テーブルのレビューです。

## 実装根拠

[初期スキーマ](../supabase/migrations/20260724000000_initial_schema.sql)、[応募部門](../supabase/migrations/20260725000000_add_entry_divisions.sql)、[初心者証明](../supabase/migrations/20260726020000_add_login_days_evidence.sql)、[旧設定](../supabase/migrations/20260726040000_add_event_rules.sql)、[レビューリセット](../supabase/migrations/20260727000000_reset_review_on_submission_change.sql)、[service_role付与](../supabase/migrations/20260728000000_grant_profiles_to_service_role.sql)、[応募期間](../supabase/migrations/20260815000000_add_submission_period.sql)、[キャラクター制約](../supabase/migrations/20260815010000_add_character_options.sql)、[画像保護](../supabase/migrations/20260816000000_protect_reviewed_submission_images.sql)、[開催回](../supabase/migrations/20260816010000_add_event_editions.sql)、[期間判定の委譲](../supabase/migrations/20260816020000_route_period_check_to_active_event.sql)、[開催回トリガー](../supabase/migrations/20260816030000_validate_event_edition_characters.sql)、[ページ画像](../supabase/migrations/20260816040000_add_event_page_images.sql)、[最終実行権限](../supabase/migrations/20260816050000_allow_admin_local_event_activation.sql)。
