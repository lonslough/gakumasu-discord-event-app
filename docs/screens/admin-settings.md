# 設定画面

[索引](../design-index.md) / [画像](../images.md) / [DB](../data-model.md) / [API](../api.md)

## 目的・ルート

`/admin/settings`、admin専用。旧 `/admin/rules` はここへ転送。開催回の作成・編集と回答受付対象切替を行います。event_editionsを作成日時降順で取得し、指定回、active回、先頭、新規開催の順で選択します。

共通Headerにライト／ダークテーマの切替を表示します。端末連動と保存規則は[共通設計](../architecture.md)を参照します。

## 項目と検証

| 項目 | 内容 |
| --- | --- |
| 編集する開催回 | 既存回＋新規開催。新規は名称・ルール・日時・2キャラクターを空へ初期化 |
| 名称 | trim後必須、入力maxLength=100 |
| 応募期間 | datetime-local、双方任意。両方ある場合start < end。ブラウザー時刻で表示、ISOへ変換して保存 |
| ページ画像 | login/entryの2枚。片方だけ指定はエラー。新規作成時も未指定なら開催回自体は保存可能 |
| キャラクター | 13名から重複しない2名。入れ替えボタンあり |
| ルール説明 | 専用モーダル、最大10,000文字 |

既存回のcharacter_optionsが2要素でない場合、画面は既定の星南・燕を使います。開催回選択が変わると画像選択をリセットします。各欄を編集しただけではDBへ保存しません。

## 設定保存

session、ルール長、名称、2キャラクター、期間、画像ペアを検証後、名称・ルール・日時・character_options・updated_byをevent_editionsへINSERTまたはUPDATEします。新規時は返却idを使用します。

画像ペアがあればZIPをStorageへupsertし、page_images_pathを更新。成功後は一覧を再取得して保存した回を選択し、作成／保存メッセージを表示します。DB成功後の画像失敗は「開催回の設定は保存しましたが…」と部分成功を通知し、開催回を消去しません。

## ルールモーダル

開いた時点のルールをdraftへコピー。「過去の開催回から呼び出す」は現在編集中のIDを除く全開催回を候補にして選択内容をdraftへコピーします。作成日時による過去判定はありません。

既存回はモーダル内保存でrules_descriptionとupdated_byを即時更新し、一覧再取得。新規回はローカルrulesへ保持し、外側の設定保存でDBへ反映します。保存中はボタン無効でonCloseも無視します。既存回の保存後は再取得でフォーム全体を設定し直すため、外側で未保存の名称・日時等を保持する保証はありません。

## 画像調整モーダル

選択時に圧縮し、canvas上で拡大率・位置を調整して確定します。保存済み画像はStorage ZIPからプレビュー。詳細な比率・圧縮・キャッシュは画像設計を参照。

## 受付対象切替

新規回または既にactiveな回では切替ボタンdisabled。保存済みpage_images_pathが必須で、画面内の未保存画像では代替しません。DEVはStorage画像をローカルキャッシュ後、set_active_event RPCを呼びます。本番ビルドはactivate-event Functionを呼びます。

成功後に開催回を再取得して成功通知。画像取得失敗、API失敗は固定日本語文言。DEVのキャッシュ更新はRPCより先のため、切替失敗時にキャッシュだけが変わる経路があります。切替専用の処理中ロックや確認モーダルはありません。

設定保存だけではactiveは変えません。本番の画像公開はWorkflow完了後です。active回の画像保存だけでは再デプロイは始まりません。

## 照合シナリオ（ソース確認）

- 新規と既存の初期値・保存先・ルール保存時点の差。
- 重複キャラクター、逆転した期間、片方だけの画像を拒否。
- 設定DB更新と画像保存の部分成功。
- 保存と受付対象切替、DEVと本番の経路を分離。

## 実装根拠

[SettingsPage.tsx](../../src/pages/SettingsPage.tsx)、[RulesEditorModal.tsx](../../src/components/settings/RulesEditorModal.tsx)、[PageImageSettings.tsx](../../src/components/settings/PageImageSettings.tsx)、[ImageCropModal.tsx](../../src/components/settings/ImageCropModal.tsx)、[characters.ts](../../src/lib/characters.ts)、[localPageImages.ts](../../src/lib/localPageImages.ts)。
