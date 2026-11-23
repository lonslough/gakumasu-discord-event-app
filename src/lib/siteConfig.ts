import { useEffect, useState } from 'react'
import { loadLocalPageImages, localPageImagesUpdatedEvent } from './localPageImages'

export interface SiteConfig {
  loginImage: string
  entryImage: string
}

export const defaultSiteConfig: SiteConfig = {
  loginImage: 'images/tsubame-sena-title1.png',
  entryImage: 'images/tsubame-sena-title2.png',
}

export const siteAssetUrl = (path: string) =>
  /^(blob:|data:|https?:)/.test(path)
    ? path
    : `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

export function useSiteConfig(): Partial<SiteConfig> & { loading: boolean; failed: boolean } {
  const [result, setResult] = useState<{ config?: SiteConfig; failed: boolean }>({ failed: false })
  useEffect(() => {
    let controller: AbortController | undefined
    let localUrls: string[] = []
    const refresh = () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      setResult({ failed: false })
      const load = async () => {
        try {
          // Settle both sources before publishing either; no provisional image.
          const local = import.meta.env.DEV ? await loadLocalPageImages() : null
          if (signal.aborted) return
          if (local) {
            const urls = [URL.createObjectURL(local.login), URL.createObjectURL(local.entry)]
            localUrls.forEach(URL.revokeObjectURL)
            localUrls = urls
            setResult({ config: { loginImage: urls[0], entryImage: urls[1] }, failed: false })
            return
          }
          const response = await fetch(`${import.meta.env.BASE_URL}site-config.json`, { cache: 'no-store', signal })
          if (!response.ok) throw new Error('site_config_unavailable')
          const loaded = await response.json() as Partial<SiteConfig>
          if (typeof loaded.loginImage !== 'string' || !loaded.loginImage || typeof loaded.entryImage !== 'string' || !loaded.entryImage) throw new Error('site_config_invalid')
          if (!signal.aborted) setResult({ config: { loginImage: loaded.loginImage, entryImage: loaded.entryImage }, failed: false })
        } catch {
          if (!signal.aborted) setResult({ failed: true })
        }
      }
      void load()
    }
    window.addEventListener(localPageImagesUpdatedEvent, refresh)
    refresh()
    return () => {
      controller?.abort()
      window.removeEventListener(localPageImagesUpdatedEvent, refresh)
      localUrls.forEach(URL.revokeObjectURL)
    }
  }, [])
  return { ...result.config, loading: !result.config && !result.failed, failed: result.failed }
}
