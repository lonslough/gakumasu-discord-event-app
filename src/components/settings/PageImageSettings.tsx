import { useEffect, useState } from 'react'
import { strToU8, zipSync } from 'fflate'
import { compressImageForUpload } from '../../lib/imageCompression'
import { cacheLocalPageImages, downloadPageImages } from '../../lib/localPageImages'
import { siteAssetUrl, useSiteConfig } from '../../lib/siteConfig'
import { supabase } from '../../lib/supabase'

interface Props {
  eventId: string | null
  isActive: boolean
  hasImages: boolean
  pageImagesPath: string | null
  onSaved: () => Promise<void>
}

function usePreview(file: File | null) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) { setUrl(''); return }
    const nextUrl = URL.createObjectURL(file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])
  return url
}

export function PageImageSettings({ eventId, isActive, hasImages, pageImagesPath, onSaved }: Props) {
  const config = useSiteConfig()
  const [loginFile, setLoginFile] = useState<File | null>(null)
  const [entryFile, setEntryFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [savedPreviews, setSavedPreviews] = useState<{ login: string; entry: string } | null>(null)
  const loginPreview = usePreview(loginFile)
  const entryPreview = usePreview(entryFile)

  useEffect(() => {
    setLoginFile(null); setEntryFile(null); setMessage(''); setError('')
  }, [eventId])

  useEffect(() => {
    let urls: string[] = []
    setSavedPreviews(null)
    if (hasImages && pageImagesPath) {
      void downloadPageImages(pageImagesPath).then((images) => {
        urls = [URL.createObjectURL(images.login), URL.createObjectURL(images.entry)]
        setSavedPreviews({ login: urls[0], entry: urls[1] })
      }).catch(() => setError('保存済みページ画像の読み込みに失敗しました。'))
    }
    return () => urls.forEach(URL.revokeObjectURL)
  }, [hasImages, pageImagesPath])

  const save = async () => {
    if (!eventId || !loginFile || !entryFile) return
    setSaving(true); setMessage(''); setError('')
    try {
      const [loginImage, entryImage] = await Promise.all([
        compressImageForUpload(loginFile), compressImageForUpload(entryFile),
      ])
      const archive = zipSync({
        'images/page/login.jpg': new Uint8Array(await loginImage.arrayBuffer()),
        'images/page/entry.jpg': new Uint8Array(await entryImage.arrayBuffer()),
        'site-config.json': strToU8(`${JSON.stringify({
          loginImage: 'images/page/login.jpg', entryImage: 'images/page/entry.jpg',
        }, null, 2)}\n`),
      }, { level: 6 })
      const path = `${eventId}/page-images.zip`
      const { error: uploadError } = await supabase.storage.from('page-images').upload(
        path, new Blob([archive], { type: 'application/zip' }),
        { contentType: 'application/zip', cacheControl: '3600', upsert: true },
      )
      if (uploadError) throw uploadError
      const { error: updateError } = await supabase.from('event_editions')
        .update({ page_images_path: path }).eq('id', eventId)
      if (updateError) throw updateError
      if (isActive) await cacheLocalPageImages(loginImage, entryImage)
      setLoginFile(null); setEntryFile(null)
      setMessage('開催回のページ画像を保存しました。「この開催回を回答受付対象にする」でこのイベントを対象へ切り替えると反映されます。')
      await onSaved()
    } catch {
      setError('ページ画像を保存できませんでした。画像形式と通信状態を確認してください。')
    } finally { setSaving(false) }
  }

  return (
    <fieldset className="settings-section">
      <legend>ページ画像</legend>
      {!eventId && <div className="notice warning">先に新しい開催回の設定を保存してください。</div>}
      {hasImages && <p className="muted">この開催回のページ画像はStorageへ保存済みです。</p>}
      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      <div className="page-image-settings-grid">
        <label>ログインページ画像
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={saving || !eventId} onChange={(event) => setLoginFile(event.target.files?.[0] ?? null)} />
          {(loginPreview || savedPreviews?.login || isActive) && <img className="page-image-preview" src={loginPreview || savedPreviews?.login || siteAssetUrl(config.loginImage)} alt="ログインページ画像のプレビュー" />}
        </label>
        <label>回答入力画面画像
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={saving || !eventId} onChange={(event) => setEntryFile(event.target.files?.[0] ?? null)} />
          {(entryPreview || savedPreviews?.entry || isActive) && <img className="page-image-preview" src={entryPreview || savedPreviews?.entry || siteAssetUrl(config.entryImage)} alt="回答入力画面画像のプレビュー" />}
        </label>
      </div>
      <button type="button" className="button secondary" disabled={saving || !eventId || !loginFile || !entryFile} onClick={() => void save()}>
        {saving ? '圧縮・保存中…' : 'ページ画像をStorageへ保存'}
      </button>
    </fieldset>
  )
}
