import { PageImage } from '../PageImageState'
import { useEffect, useState } from 'react'
import { strToU8, zipSync } from 'fflate'
import { compressImageForUpload } from '../../lib/imageCompression'
import { cacheLocalPageImages, downloadPageImages } from '../../lib/localPageImages'
import { siteAssetUrl, useSiteConfig } from '../../lib/siteConfig'
import { supabase } from '../../lib/supabase'
import { ImageCropModal } from './ImageCropModal'

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

export async function uploadPageImages(eventId: string, files: PageImageFiles, isActive: boolean, savedPath: string | null = null) {
  if (!files.login && !files.entry) throw new Error('page_images_incomplete')
  let saved: Awaited<ReturnType<typeof downloadPageImages>> | null = null
  if ((!files.login || !files.entry) && savedPath) saved = await downloadPageImages(savedPath)
  if ((!files.login && !saved?.login) || (!files.entry && !saved?.entry))
    throw new Error('page_images_incomplete')
  const [loginImage, entryImage] = await Promise.all([
    files.login ? compressImageForUpload(files.login) : Promise.resolve(saved!.login),
    files.entry ? compressImageForUpload(files.entry) : Promise.resolve(saved!.entry),
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
  if (isActive) await cacheLocalPageImages(loginImage, entryImage, eventId)
}

function usePreview(file: File | null) {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const nextUrl = URL.createObjectURL(file)
    setPreview({ file, url: nextUrl })
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])
  return preview?.file === file ? preview?.url : undefined
}

export function PageImageSettings({ isActive, pageImagesPath, files, onFilesChange }: Props) {
  const config = useSiteConfig()
  const [error, setError] = useState('')
  const [savedPreviews, setSavedPreviews] = useState<{ path: string; login?: string; entry?: string; failed?: boolean } | null>(null)
  const [editing, setEditing] = useState<{ target: keyof PageImageFiles; file: File } | null>(null)
  const loginPreview = usePreview(files.login)
  const entryPreview = usePreview(files.entry)

  const openEditor = async (target: keyof PageImageFiles, file: File) => {
    setError('')
    try {
      setEditing({ target, file: await compressImageForUpload(file) })
    } catch {
      setError('画像を読み込めませんでした。別の画像形式でお試しください。')
    }
  }

  useEffect(() => {
    let cancelled = false
    let urls: string[] = []
    setSavedPreviews(null)
    setError('')
    if (pageImagesPath) {
      void downloadPageImages(pageImagesPath).then((images) => {
        if (cancelled) return
        urls = [URL.createObjectURL(images.login), URL.createObjectURL(images.entry)]
        setSavedPreviews({ path: pageImagesPath, login: urls[0], entry: urls[1] })
      }).catch(() => {
        if (!cancelled) { setSavedPreviews({ path: pageImagesPath, failed: true }); setError('保存済みページ画像の読み込みに失敗しました。') }
      })
    }
    return () => { cancelled = true; urls.forEach(URL.revokeObjectURL) }
  }, [pageImagesPath])

  const saved = savedPreviews?.path === pageImagesPath ? savedPreviews : null

  return (
    <fieldset className="settings-section">
      <legend>ページ画像</legend>
      {error && <div className="notice error">{error}</div>}
      <div className="page-image-settings-grid">
        <label>ログインページ画像
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void openEditor('login', file)
            event.target.value = ''
          }} />
          {(files.login || pageImagesPath || isActive) && <PageImage className="page-image-preview" source={loginPreview || (!files.login ? saved?.login || (!pageImagesPath && config.loginImage ? siteAssetUrl(config.loginImage) : undefined) : undefined)} failed={!files.login && Boolean(pageImagesPath ? saved?.failed : config.failed)} alt="ログインページ画像のプレビュー" />}
        </label>
        <label>回答入力画面画像
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void openEditor('entry', file)
            event.target.value = ''
          }} />
          {(files.entry || pageImagesPath || isActive) && <PageImage className="page-image-preview" source={entryPreview || (!files.entry ? saved?.entry || (!pageImagesPath && config.entryImage ? siteAssetUrl(config.entryImage) : undefined) : undefined)} failed={!files.entry && Boolean(pageImagesPath ? saved?.failed : config.failed)} alt="回答入力画面画像のプレビュー" />}
        </label>
      </div>
      {editing && (
        <ImageCropModal
          previewTarget={editing.target}
          file={editing.file}
          title={`${editing.target === 'login' ? 'ログインページ' : '回答入力画面'}画像の調整`}
          aspectRatio={editing.target === 'login' ? null : 16 / 5}
          onCancel={() => setEditing(null)}
          onConfirm={(file) => {
            onFilesChange({ ...files, [editing.target]: file })
            setEditing(null)
          }}
        />
      )}
    </fieldset>
  )
}
