import { useEffect, useState } from 'react'

type ImageState = { source: string | undefined; url?: string; failed?: boolean }

// Resolve the selected bytes before mounting a visible img. HTTP images must be
// fetched again because published page images can change without changing URLs.
export function usePageImage(source: string | undefined, failed = false) {
  const [result, setResult] = useState<ImageState>({ source: undefined })
  useEffect(() => {
    if (!source) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    const image = new Image()
    const load = async () => {
      try {
        let url = source
        if (!/^(blob:|data:)/.test(source)) {
          const response = await fetch(source, { cache: 'no-store', signal: controller.signal })
          if (!response.ok) throw new Error('page_image_unavailable')
          const blob = await response.blob()
          if (controller.signal.aborted) return
          objectUrl = URL.createObjectURL(blob)
          url = objectUrl
        }
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject(new Error('page_image_invalid'))
          image.src = url
        })
        if (image.decode) await image.decode()
        if (!controller.signal.aborted) setResult({ source, url })
      } catch {
        if (!controller.signal.aborted) setResult({ source, failed: true })
      }
    }
    void load()
    return () => {
      controller.abort()
      image.onload = null
      image.onerror = null
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [source])
  if (result.source !== source) setResult({ source })
  const current = result.source === source ? result : undefined
  if (failed || current?.failed) return { status: 'error' as const, url: undefined }
  if (!current?.url) return { status: 'loading' as const, url: undefined }
  return { status: 'ready' as const, url: current.url }
}

export function ImagePlaceholder({ failed = false }: { failed?: boolean }) {
  return <div className={`page-image-placeholder ${failed ? 'page-image-skeleton' : ''}`} role="status" aria-label={failed ? '画像を表示できません' : '画像を読み込み中'}>{!failed && <div className="spinner" />}</div>
}

export function PageImage({ source, failed, alt, className = '' }: { source?: string; failed?: boolean; alt: string; className?: string }) {
  const image = usePageImage(source, failed)
  return <div className={`page-image-frame ${className}`} aria-busy={image.status === 'loading'}>{image.status === 'ready' ? <img src={image.url} alt={alt} /> : <ImagePlaceholder failed={image.status === 'error'} />}</div>
}
