import { useEffect, useState } from 'react'
import { strToU8, zipSync } from 'fflate'
import { compressImageForUpload } from '../../lib/imageCompression'
import { cacheLocalPageImages, downloadPageImages } from '../../lib/localPageImages'
import { siteAssetUrl, useSiteConfig } from '../../lib/siteConfig'
import { supabase } from '../../lib/supabase'

interface Props {
  isActive: boolean
  pageImagesPath: string | null
  files: PageImageFiles
  onFilesChange: (files: PageImageFiles) => void
}

export interface PageImageFiles {
  login: File | null
  entry: File | null
}

export async function uploadPageImages(eventId: string, files: PageImageFiles, isActive: boolean) {
  if (!files.login || !files.entry) throw new Error('page_images_incomplete')
  const [loginImage, entryImage] = await Promise.all([
    compressImageForUpload(files.login), compressImageForUpload(files.entry),
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

export function PageImageSettings({ isActive, pageImagesPath, files, onFilesChange }: Props) {
  const config = useSiteConfig()
  const [error, setError] = useState('')
  const [savedPreviews, setSavedPreviews] = useState<{ login: string; entry: string } | null>(null)
  const loginPreview = usePreview(files.login)
  const entryPreview = usePreview(files.entry)

  useEffect(() => {
    let urls: string[] = []
    setSavedPreviews(null)
    if (pageImagesPath) {
      void downloadPageImages(pageImagesPath).then((images) => {
        urls = [URL.createObjectURL(images.login), URL.createObjectURL(images.entry)]
        setSavedPreviews({ login: urls[0], entry: urls[1] })
      }).catch(() => setError('保存済みページ画像の読み込みに失敗しました。'))
    }
    return () => urls.forEach(URL.revokeObjectURL)
  }, [pageImagesPath])

  return (
    <fieldset className="settings-section">
      <legend>ページ画像</legend>
      {error && <div className="notice error">{error}</div>}
      <div className="page-image-settings-grid">
        <label>ログインページ画像
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => onFilesChange({ ...files, login: event.target.files?.[0] ?? null })} />
          {(loginPreview || savedPreviews?.login || isActive) && <img className="page-image-preview" src={loginPreview || savedPreviews?.login || siteAssetUrl(config.loginImage)} alt="ログインページ画像のプレビュー" />}
        </label>
        <label>回答入力画面画像
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => onFilesChange({ ...files, entry: event.target.files?.[0] ?? null })} />
          {(entryPreview || savedPreviews?.entry || isActive) && <img className="page-image-preview" src={entryPreview || savedPreviews?.entry || siteAssetUrl(config.entryImage)} alt="回答入力画面画像のプレビュー" />}
        </label>
      </div>
    </fieldset>
  )
}
