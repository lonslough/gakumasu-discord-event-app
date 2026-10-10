import { useEffect, useRef, useState } from 'react'
import type { ReviewImages } from '../components/responses/ResponseModals'
import { hasResultImage } from '../lib/adminResponses'
import { supabase } from '../lib/supabase'
import type { AdminSubmission, Submission } from '../types'

interface CachedReviewImages {
  fingerprint: string
  images: ReviewImages
  complete: boolean
}

const baseName = (path: string) => path.split('/').pop() ?? path

const revokeImageUrls = (images: ReviewImages) => {
  Object.values(images).forEach((image) => {
    if (image) URL.revokeObjectURL(image.url)
  })
}

export function useReviewImages(onError: (message: string) => void) {
  const [images, setImages] = useState<ReviewImages>({})
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef(new Map<string, CachedReviewImages>())
  const requestRef = useRef(0)

  useEffect(() => {
    const cache = cacheRef.current
    return () => cache.forEach(({ images: cachedImages }) => revokeImageUrls(cachedImages))
  }, [])

  const clear = () => {
    requestRef.current += 1
    setImages({})
    setLoading(false)
  }

  const load = async (row: AdminSubmission): Promise<AdminSubmission | null> => {
    const requestId = ++requestRef.current
    setImages({})
    setLoading(true)

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', row.id)
      .single()
    if (error) {
      if (requestId === requestRef.current) {
        onError('提出画像の更新状態を確認できませんでした。')
        setLoading(false)
      }
      return null
    }

    const current = data
      ? ({ ...row, ...(data as Submission) } as AdminSubmission)
      : row
    if (requestId !== requestRef.current) return null

    const paths = {
      result: hasResultImage(current) ? current.score_image_path : null,
      beginnerProof: current.beginner_proof_image_path,
      loginDaysProof: current.login_days_proof_image_path,
    }
    const fingerprint = JSON.stringify(paths)
    const cached = cacheRef.current.get(row.id)
    if (cached?.fingerprint === fingerprint && cached.complete) {
      setImages(cached.images)
      setLoading(false)
      return current
    }

    const entries = await Promise.all(
      Object.entries(paths).map(async ([key, path]) => {
        if (!path) return [key, undefined] as const
        const { data: blob, error: downloadError } = await supabase.storage
          .from('submission-images')
          .download(path)
        if (downloadError) return [key, undefined] as const
        return [key, { url: URL.createObjectURL(blob), name: baseName(path) }] as const
      }),
    )
    const loadedImages = Object.fromEntries(entries) as ReviewImages
    const failed = Object.values(paths).filter(Boolean).length !==
      Object.values(loadedImages).filter(Boolean).length

    if (requestId !== requestRef.current) {
      revokeImageUrls(loadedImages)
      return null
    }
    if (cached) revokeImageUrls(cached.images)
    cacheRef.current.set(row.id, { fingerprint, images: loadedImages, complete: !failed })
    if (failed) onError('一部の画像を開けませんでした。')
    setImages(loadedImages)
    setLoading(false)
    return current
  }

  return { images, loading, load, clear }
}
