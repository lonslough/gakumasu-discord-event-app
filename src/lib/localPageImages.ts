import { unzipSync } from 'fflate'
import { supabase } from './supabase'

const databaseName = 'gakumasu-local-page-images'
const storeName = 'images'
const updatedEvent = 'local-page-images-updated'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function cacheLocalPageImages(loginImage: Blob, entryImage: Blob) {
  if (!import.meta.env.DEV) return
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(loginImage, 'login')
    transaction.objectStore(storeName).put(entryImage, 'entry')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
  window.dispatchEvent(new Event(updatedEvent))
}

export async function cacheLocalPageImagesFromStorage(path: string) {
  if (!import.meta.env.DEV) return
  const images = await downloadPageImages(path)
  await cacheLocalPageImages(images.login, images.entry)
}

export async function downloadPageImages(path: string) {
  const { data, error } = await supabase.storage.from('page-images').download(path)
  if (error) throw error
  const files = unzipSync(new Uint8Array(await data.arrayBuffer()))
  const login = files['images/page/login.jpg']
  const entry = files['images/page/entry.jpg']
  if (!login || !entry) throw new Error('page_images_invalid')
  return {
    login: new Blob([login], { type: 'image/jpeg' }),
    entry: new Blob([entry], { type: 'image/jpeg' }),
  }
}

export async function loadLocalPageImages() {
  if (!import.meta.env.DEV) return null
  const database = await openDatabase()
  const result = await new Promise<{ login?: Blob; entry?: Blob }>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const loginRequest = transaction.objectStore(storeName).get('login')
    const entryRequest = transaction.objectStore(storeName).get('entry')
    transaction.oncomplete = () => resolve({ login: loginRequest.result, entry: entryRequest.result })
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
  return result.login && result.entry ? result as { login: Blob; entry: Blob } : null
}

export const localPageImagesUpdatedEvent = updatedEvent
