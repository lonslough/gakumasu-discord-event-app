# 画像設計

[索引](design-index.md) / [回答入力](screens/entry.md) / [設定](screens/admin-settings.md)

## 提出画像

入力時の拡張子はjpg/jpeg/png/heic/heif、MIMEはimage/jpeg、image/png、image/heic、image/heifおよびheic/heif-sequence。両者をそれぞれ許可リストで検査し、ファイルは10MiB以下。拡張子とMIMEの組み合わせ一致や画像内容のOCR判定は行いません。

JPEG/PNGは選択時にObject URLでプレビュー。HEIC/HEIFは選択時プレビュー対象外ですが、送信時heic2anyでJPEGへ変換します。その後browser-image-compressionでJPEG・長辺1920px以内・maxSizeMB=1・initialQuality=0.82・EXIF非保持・Web Worker使用の設定で圧縮します。1MBは圧縮設定の目標で、Storage上限とは別です。

submission-imagesバケットはprivate、上限10MiB。新規パスは `auth.uid()/score/UUID.jpg`、`beginner-proof`、`login-days-proof`。上書きせず新UUIDを生成します。旧deckパスはDB・Storage互換用に残ります。

保存順序は結果画像→初心者PID画像→日数画像を必要時アップロード→submissionsを `(event_id,user_id)` でupsert→不要になった旧画像を削除。DBまでの失敗時は今回アップロードした画像の削除を試みます。削除レスポンスのerrorを個別検査する再試行処理はありません。

RLSは本人・adminの閲覧、受付期間中の本人の新規保存を許可。Storage UPDATEポリシーは削除済みです。DELETEは受付期間中、本人配下、本人のどの回答行からも参照されないオブジェクトに限定します。受付終了時等には後片付けが失敗して孤立画像が残り得ます。

## 提出画像の閲覧

- 回答入力：既存画像ボタンで600秒の署名URLを作成。コンポーネント内で再利用し、パス変更でキャッシュをクリア。期限切れによる自動再発行はありません。
- 回答結果：モーダル開始時に最新submissions行を取得し、画像パスの組をfingerprintにします。Storageから認証付きdownloadしたBlobをObject URLへ変換。パスが同じで全画像取得済みならキャッシュを再利用します。
- 管理画像キャッシュは画面のメモリ内のみ。画面終了・差し替え・古いリクエスト結果でURLを解放。画像取得失敗は一部画像を未表示としてエラーを出し、次の表示で再取得可能。
- 参加履歴：各画像のボタン操作時に認証付きdownloadでBlob URLを表示。旧形式のscore/deckも別々に閲覧可能。閉じる・画面離脱・パス変更・再試行でURLを解放し、古い応答を破棄。取得・表示失敗は画像単位に通知し再試行できます。[HistoryImage.tsx](../src/components/history/HistoryImage.tsx)
- 3画面で画像の新規タブ表示が可能。管理画面・参加履歴画面は署名URLを発行しません。

## ページ画像

設定画面の選択欄はJPEG/PNG/WebP/HEIC/HEIFを受け付け、提出画像用validateImageFileを呼びません。選択時に一度圧縮してImageCropModalへ渡し、確定画像を設定保存時に再圧縮します。

canvas出力幅は1600px。ログイン用は元画像の比率、回答入力用は16:5で高さ500px。初期状態はcontainで画像全体を中央へ配置し、余白色は#15182d。倍率1〜3、縦横位置-1〜1をスライダーまたはドラッグで調整。確定時はJPEG品質0.9でFileを生成します。

fflateで次の3ファイルをZIP化し、privateのpage-imagesへ `eventId/page-images.zip` としてupsertします。DBのpage_images_pathも更新します。バケット上限は5MiB、MIMEはapplication/zip、adminがSELECT/INSERT/UPDATE可能。画像保存失敗時でも開催回の作成・設定更新はロールバックしません。

```text
images/page/login.jpg
images/page/entry.jpg
site-config.json   # loginImage / entryImageに上記相対パスを指定
```

公開時はPages WorkflowがZIPをpublicへ展開してからビルドします。通常閲覧は公開配信画像でありprivate Storageへ接続しません。画像保存のみではWorkflowは起動しません。開催回切替で起動、active回の画像だけを変更した場合は手動実行またはmain pushが必要です。

## 開発中の画像と設定取得

useSiteConfigは既定画像 `images/tsubame-sena-title1.png` / `images/tsubame-sena-title2.png` で初期化し、BASE_URL配下のsite-config.jsonをno-cacheで取得。両キーがあれば反映し、取得失敗時は現在の値（既定画像またはDEVのローカル画像）を維持します。DEVでローカル画像を読み込んだ場合はJSONの値よりそちらを優先します。siteAssetUrlはblob/data/http(s)をそのまま、それ以外をBASE_URL相対にします。

DEV時はIndexedDB `gakumasu-local-page-images` のimagesストアからlogin/entryを読みます。active回の画像保存時は生成したJPEGのBlobを直接キャッシュし、切替準備時はStorageのZIPをダウンロード・展開してキャッシュします。local-page-images-updatedイベントで表示を更新。キャッシュは開催回IDやユーザーIDで分離していません。ログアウトで消去する処理もありません。本番モードのキャッシュ読書きは早期returnします。

設定画面の保存済みプレビューは選択開催回のZIPをStorageからダウンロードします。一般公開画像と管理画面プレビューの取得経路は別です。サンプル画像はpublic/sampleの静的ファイルを使います。

## 実装根拠

[validation.ts](../src/lib/validation.ts)、[imageCompression.ts](../src/lib/imageCompression.ts)、[entryService.ts](../src/lib/entryService.ts)、[ImageFileField.tsx](../src/components/entry/ImageFileField.tsx)、[useReviewImages.ts](../src/hooks/useReviewImages.ts)、[PageImageSettings.tsx](../src/components/settings/PageImageSettings.tsx)、[ImageCropModal.tsx](../src/components/settings/ImageCropModal.tsx)、[siteConfig.ts](../src/lib/siteConfig.ts)、[localPageImages.ts](../src/lib/localPageImages.ts)、[画像保護SQL](../supabase/migrations/20260816000000_protect_reviewed_submission_images.sql)、[ページ画像SQL](../supabase/migrations/20260816040000_add_event_page_images.sql)。
