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

export async function cacheLocalPageImages(loginImage: Blob, entryImage: Blob, eventId: string) {
  if (!import.meta.env.DEV) return
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put({ eventId, login: loginImage, entry: entryImage }, 'active')
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
  window.dispatchEvent(new Event(updatedEvent))
}

export async function cacheLocalPageImagesFromStorage(path: string) {
  if (!import.meta.env.DEV) return
  const images = await downloadPageImages(path)
  await cacheLocalPageImages(images.login, images.entry, path.split('/')[0])
}

export async function downloadPageImages(path: string) {
  const { data, error } = await supabase.storage.from('page-images').download(path, {}, { cache: 'no-store' })
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
  try {
    const result = await new Promise<{ eventId?: string; login?: Blob; entry?: Blob } | undefined>((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly')
      const request = transaction.objectStore(storeName).get('active')
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    // Legacy unscoped login/entry entries are intentionally ignored.
    return result?.eventId && result.login instanceof Blob && result.entry instanceof Blob
      ? { eventId: result.eventId, login: result.login, entry: result.entry } : null
  } finally {
    database.close()
  }
}

export const localPageImagesUpdatedEvent = updatedEvent
