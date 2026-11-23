import { useEffect, useState } from 'react'

export type ImageScenario = 'normal' | 'slow' | 'loading' | 'error'
let scenario: ImageScenario = 'normal'
let revision = 0
export const imageReviewEvent = 'mock-image-review'
export const getImageReview = () => ({ scenario, revision })
export function setImageReview(value: ImageScenario) {
  scenario = value
  revision++
  window.dispatchEvent(new Event(imageReviewEvent))
}
export function useImageReview() {
  const [value, setValue] = useState(getImageReview)
  useEffect(() => {
    const update = () => setValue(getImageReview())
    window.addEventListener(imageReviewEvent, update)
    return () => window.removeEventListener(imageReviewEvent, update)
  }, [])
  return value
}
export async function imageReviewDelay() {
  const mode = scenario
  if (mode === 'loading') await new Promise(() => {})
  await new Promise(resolve => setTimeout(resolve, mode === 'slow' ? 2500 : 350))
  if (mode === 'error') throw new Error('mock_image_failure')
}
export function ImagePlaceholder({ failed = false }: { failed?: boolean }) {
  return <div className={`page-image-placeholder ${failed ? 'page-image-skeleton' : ''}`} role="status" aria-label={failed ? '画像を表示できません' : '画像を読み込み中'}>{!failed && <div className="spinner" />}</div>
}
export function usePageImage(source: string | undefined, failed = false) {
  const review = useImageReview()
  const key = `${source ?? ''}:${review.revision}`
  const [result, setResult] = useState({ key: '', state: 'loading' })
  useEffect(() => {
    if (!source) return
    let cancelled = false
    const image = new Image()
    const run = async () => {
      try {
        await imageReviewDelay()
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve()
          image.onerror = () => reject(new Error('image_decode'))
          image.src = source
        })
        if (image.decode) await image.decode()
        if (!cancelled) setResult({ key, state: 'ready' })
      } catch {
        if (!cancelled) setResult({ key, state: 'error' })
      }
    }
    void run()
    return () => { cancelled = true; image.onload = null; image.onerror = null }
  }, [source, key])
  if (failed) return 'error'
  return result.key === key ? result.state : 'loading'
}
export function PageImage({ source, failed, alt, className = '' }: { source?: string; failed?: boolean; alt: string; className?: string }) {
  const state = usePageImage(source, failed)
  return <div className={`page-image-frame ${className}`} aria-busy={state === 'loading'}>{state === 'ready' ? <img src={source} alt={alt} /> : <ImagePlaceholder failed={state === 'error'} />}</div>
}
export function ImageReviewControls() {
  const value = useImageReview()
  return <details className="mock-image-review"><summary>モック確認：画像の読み込み</summary><label>画像表示シナリオ<select value={value.scenario} onChange={event => setImageReview(event.target.value as ImageScenario)}><option value="normal">通常</option><option value="slow">低速（2.5秒）</option><option value="loading">読込中を維持</option><option value="error">読込失敗（スケルトン）</option></select></label><p>設定・ログイン・回答入力に共通。再読み込みで初期化されます。</p></details>
}
