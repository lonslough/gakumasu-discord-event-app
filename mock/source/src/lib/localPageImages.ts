import { unzipSync } from 'fflate'
import { supabase } from './supabase'
import { setMockPageImages } from './siteConfig'
export const localPageImagesUpdatedEvent = 'mock-images'
export async function cacheLocalPageImages(login: Blob, entry: Blob) { setMockPageImages({loginImage: URL.createObjectURL(login),entryImage: URL.createObjectURL(entry)}) }
export async function downloadPageImages(path: string) { const {data,error}=await supabase.storage.from('page-images').download(path); if(error) throw error; const files=unzipSync(new Uint8Array(await data.arrayBuffer())); return {login:new Blob([files['images/page/login.jpg']],{type:'image/jpeg'}),entry:new Blob([files['images/page/entry.jpg']],{type:'image/jpeg'})} }
export async function cacheLocalPageImagesFromStorage(path: string) { const images=await downloadPageImages(path); await cacheLocalPageImages(images.login,images.entry) }
export async function loadLocalPageImages() { return null }
