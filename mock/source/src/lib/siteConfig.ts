import { useEffect, useState } from 'react'
import { imageReviewDelay, useImageReview } from '../components/PageImageState'
export interface SiteConfig { loginImage: string; entryImage: string }
export const defaultSiteConfig = { loginImage: 'images/tsubame-sena-title1.png', entryImage: 'images/tsubame-sena-title2.png' }
let current = defaultSiteConfig
let version = 0
export const siteAssetUrl = (path: string) => path
export function setMockPageImages(images: SiteConfig) {
  const previous = current
  current = images
  version++
  window.dispatchEvent(new Event('mock-images'))
  for (const url of Object.values(previous)) if(url.startsWith('blob:')) URL.revokeObjectURL(url)
}
export function useSiteConfig() {
  const review = useImageReview()
  const [configVersion, setConfigVersion] = useState(version)
  const key = `${configVersion}:${review.revision}`
  const [result, setResult] = useState<{key: string; config?: SiteConfig; failed?: boolean}>({key: ''})
  useEffect(() => {
    const update = () => setConfigVersion(version)
    window.addEventListener('mock-images', update)
    return () => window.removeEventListener('mock-images', update)
  }, [])
  useEffect(() => {
    let cancelled = false
    const next = current
    imageReviewDelay().then(() => { if (!cancelled) setResult({key, config: next}) })
      .catch(() => { if (!cancelled) setResult({key, failed: true}) })
    return () => { cancelled = true }
  }, [key])
  return result.key === key ? {...result.config, loading: !result.config && !result.failed, failed: result.failed} : {loading: true}
}
