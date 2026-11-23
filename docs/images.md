# 画像設計

[索引](design-index.md) / [回答入力](screens/entry.md) / [設定](screens/admin-settings.md)

## 提出画像

入力時の拡張子はjpg/jpeg/png/heic/heif、MIMEはimage/jpeg、image/png、image/heic、image/heifおよびheic/heif-sequence。両者をそれぞれ許可リストで検査し、ファイルは10MiB以下。拡張子とMIMEの組み合わせ一致や画像内容のOCR判定は行いません。

JPEG/PNGは選択時にObject URLでプレビュー。HEIC/HEIFは選択時プレビュー対象外ですが、送信時heic2anyでJPEGへ変換します。その後browser-image-compressionでJPEG・長辺1920px以内・maxSizeMB=1・initialQuality=0.82・EXIF非保持・Web Worker使用の設定で圧縮します。1MBは圧縮設定の目標で、Storage上限とは別です。

submission-imagesバケットはprivate、上限10MiB。新規パスは `auth.uid()/score/UUID.jpg`、`beginner-proof`、`login-days-proof`。上書きせず新UUIDを生成します。旧deckパスはDB・Storage互換用に残ります。

保存順序は結果画像→選択部門で証明必須の場合にPID画像→日数画像を必要時アップロード→submissionsを `(event_id,user_id)` でupsert→不要になった旧画像を削除。DBまでの失敗時は今回アップロードした画像の削除を試みます。削除レスポンスのerrorを個別検査する再試行処理はありません。

RLSは本人・adminの閲覧、受付期間中の本人の新規保存を許可。Storage UPDATEポリシーは削除済みです。DELETEは受付期間中、本人配下、本人のどの回答行からも参照されないオブジェクトに限定します。受付終了時等には後片付けが失敗して孤立画像が残り得ます。

## 提出画像の閲覧

- 回答入力：既存画像ボタンで600秒の署名URLを作成。コンポーネント内で再利用し、パス変更でキャッシュをクリア。期限切れによる自動再発行はありません。
- ランキングの管理者ビュー（旧回答結果）：モーダル開始時に最新submissions行を取得し、画像パスの組をfingerprintにします。Storageから認証付きdownloadしたBlobをObject URLへ変換。パスが同じで全画像取得済みならキャッシュを再利用します。一般向けランキングは画像UI・取得処理を持たず、公開RPCにも画像パスを含めません。
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

useSiteConfigは画像未確定のloading状態で開始し、BASE_URL配下のsite-config.jsonをcache:no-storeで取得します。loginImage/entryImageを検証してから同時に公開し、取得失敗・不正JSONはfailed状態にします。既定画像を暫定表示してから差し替える動作はありません。既定の配信画像はpublic/site-config.jsonに定義しています。siteAssetUrlはblob/data/http(s)をそのまま、それ以外をBASE_URL相対にします。

PageImageStateのusePageImageはHTTP画像をcache:no-storeでBlobとして再取得し、Imageのloadとdecode完了後にBlob URLを表示します。同じパスに画像を上書きしても古いブラウザー画像キャッシュを暫定表示しません。元のsourceが変わると同じ描画で旧画像を隠し、旧リクエストはabort／破棄、所有するObject URLは解放します。画像設定の確定・画像取得・デコード中はスピナーのみ、失敗はスピナーを停止して静止スケルトンを表示します。role=statusとaria-labelで読み上げ状態を伝え、可視テキストは追加しません。対象はログインのタイトル・回答入力バナー・設定の2プレビューです。

DEV時はIndexedDB `gakumasu-local-page-images` のimagesストアのactiveレコードに、開催回ID(eventId)・login/entryのBlobを1組で保存します。旧login/entryの開催回情報を持たない独立キャッシュは読みません。active回の画像保存成功時と受付対象切替成功後に更新し、local-page-images-updatedイベントで表示を更新します。useSiteConfigはこの読込が確定するまでJSON画像も表示せず、有効なローカル画像があれば優先します。レコードがない場合は公開JSONを取得します。本番モードはキャッシュを読み書きしません。ユーザーIDでは分離せずログアウトで消去しない既存仕様は維持します。外部セッションや別タブからの変更をリアルタイム検出する仕組みはありません。

設定画面の保存済みプレビューは選択開催回のZIPをStorageからcache:no-storeでダウンロードします。取得中の公開画像フォールバックは行いません。選択回・保存版のkeyで画像状態を作り直し、開催回選択時の未保存ファイルも同時にリセットします。新規・非active回の画像未登録は空欄、active回で保存パスがない場合のみ公開画像を正式な表示元として解決します。一般公開画像と管理画面プレビューの取得経路は別です。サンプル画像はpublic/sampleの静的ファイルを使います。

## 実装根拠

[validation.ts](../src/lib/validation.ts)、[imageCompression.ts](../src/lib/imageCompression.ts)、[entryService.ts](../src/lib/entryService.ts)、[ImageFileField.tsx](../src/components/entry/ImageFileField.tsx)、[useReviewImages.ts](../src/hooks/useReviewImages.ts)、[PageImageSettings.tsx](../src/components/settings/PageImageSettings.tsx)、[ImageCropModal.tsx](../src/components/settings/ImageCropModal.tsx)、[siteConfig.ts](../src/lib/siteConfig.ts)、[localPageImages.ts](../src/lib/localPageImages.ts)、[画像保護SQL](../supabase/migrations/20260816000000_protect_reviewed_submission_images.sql)、[ページ画像SQL](../supabase/migrations/20260816040000_add_event_page_images.sql)。

2026-11-23: v8承認後に実装。取得・デコード待ち、旧応答破棄、保存済み画像取得失敗、切替API失敗時のキャッシュ非更新を自動検証。全142テスト・lint・build成功。実ブラウザー描画とIndexedDB/HTTPキャッシュの実操作確認は保留。[検証記録](verification.md)。


2026-11-24: 証明画像の必須判定は初心者という固定IDではなく開催回部門のrequiresProofで決定します。保存先のbeginner-proof/login-days-proofという互換パス名と既存Storageポリシー・圧縮・レビュー保護は維持。カスタム証明部門の再保存でも既存2パスを保持します。[回答入力](screens/entry.md)。
