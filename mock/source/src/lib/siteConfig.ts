import { useEffect, useState } from 'react'
export interface SiteConfig { loginImage: string; entryImage: string }
export const defaultSiteConfig = { loginImage: 'images/tsubame-sena-title1.png', entryImage: 'images/tsubame-sena-title2.png' }
let current = defaultSiteConfig
export const siteAssetUrl = (path: string) => path
export function setMockPageImages(images: SiteConfig) { for (const url of Object.values(current)) if(url.startsWith('blob:')) URL.revokeObjectURL(url); current=images; window.dispatchEvent(new Event('mock-images')) }
export function useSiteConfig() { const [config, setConfig]=useState(current); useEffect(()=>{const update=()=>setConfig(current); window.addEventListener('mock-images',update); return ()=>window.removeEventListener('mock-images',update)},[]); return config }
