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

export function useSiteConfig(): SiteConfig {
  const [config, setConfig] = useState(defaultSiteConfig)

  useEffect(() => {
    const controller = new AbortController()
    let localUrls: string[] = []
    const loadLocal = async () => {
      const images = await loadLocalPageImages()
      if (!images || controller.signal.aborted) return false
      localUrls.forEach(URL.revokeObjectURL)
      localUrls = [URL.createObjectURL(images.login), URL.createObjectURL(images.entry)]
      setConfig({ loginImage: localUrls[0], entryImage: localUrls[1] })
      return true
    }
    const refresh = () => { void loadLocal() }
    window.addEventListener(localPageImagesUpdatedEvent, refresh)
    if (import.meta.env.DEV) void loadLocal()
    void fetch(`${import.meta.env.BASE_URL}site-config.json`, {
      cache: 'no-cache',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('site config unavailable')
        return (await response.json()) as Partial<SiteConfig>
      })
      .then((loaded) => {
        if (import.meta.env.DEV && localUrls.length) return
        if (loaded.loginImage && loaded.entryImage)
          setConfig({
            loginImage: loaded.loginImage,
            entryImage: loaded.entryImage,
          })
      })
      .catch(() => undefined)
    return () => {
      controller.abort()
      window.removeEventListener(localPageImagesUpdatedEvent, refresh)
      localUrls.forEach(URL.revokeObjectURL)
    }
  }, [])

  return config
}
