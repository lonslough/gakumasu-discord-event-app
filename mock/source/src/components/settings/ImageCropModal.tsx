import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '../Modal'
import { PageImageGuide } from './PageImageGuide'

interface Props {
  file: File
  title: string
  aspectRatio: number | null
  previewTarget?: 'login' | 'entry'
  onCancel: () => void
  onConfirm: (file: File) => void
}

const outputWidth = 1600

export function ImageCropModal({ file, title, aspectRatio, previewTarget, onCancel, onConfirm }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const image = useRef<HTMLImageElement | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [previewSource, setPreviewSource] = useState('')
  const [imageError, setImageError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [positionX, setPositionX] = useState(0)
  const [positionY, setPositionY] = useState(0)
  const [ready, setReady] = useState(false)
  const [canvasHeight, setCanvasHeight] = useState(
    Math.round(outputWidth / (aspectRatio ?? 1)),
  )

  const draw = useCallback(() => {
    const target = canvas.current
    const source = image.current
    if (!target || !source) return
    const context = target.getContext('2d')
    if (!context) return
    const baseScale = Math.min(target.width / source.naturalWidth, target.height / source.naturalHeight)
    const scale = baseScale * zoom
    const width = source.naturalWidth * scale
    const height = source.naturalHeight * scale
    const x = (target.width - width) / 2 + positionX * (target.width - width) / 2
    const y = (target.height - height) / 2 + positionY * (target.height - height) / 2
    context.fillStyle = '#15182d'
    context.fillRect(0, 0, target.width, target.height)
    context.drawImage(source, x, y, width, height)
    if (previewTarget) setPreviewSource(target.toDataURL('image/jpeg', 0.75))
  }, [positionX, positionY, zoom, previewTarget])

  useEffect(() => {
    const url = URL.createObjectURL(file)
    let cancelled = false
    setReady(false)
    setImageError('')
    const nextImage = new Image()
    nextImage.onload = () => {
      if (cancelled) return
      image.current = nextImage
      setCanvasHeight(Math.round(
        aspectRatio
          ? outputWidth / aspectRatio
          : outputWidth * nextImage.naturalHeight / nextImage.naturalWidth,
      ))
      setReady(true)
    }
    nextImage.onerror = () => {
      if (!cancelled) setImageError('画像を読み込めませんでした。キャンセルして別の画像を選択してください。')
    }
    nextImage.src = url
    return () => { cancelled = true; URL.revokeObjectURL(url) }
  }, [aspectRatio, file])

  useEffect(() => draw(), [canvasHeight, draw, ready])

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current || !canvas.current || !image.current) return
    const rect = canvas.current.getBoundingClientRect()
    const scale = Math.min(canvas.current.width / image.current.naturalWidth, canvas.current.height / image.current.naturalHeight) * zoom
    const travelX = canvas.current.width - image.current.naturalWidth * scale
    const travelY = canvas.current.height - image.current.naturalHeight * scale
    if (Math.abs(travelX) > 1)
      setPositionX((value) => Math.max(-1, Math.min(1, value + (event.clientX - drag.current!.x) * canvas.current!.width / rect.width * 2 / travelX)))
    if (Math.abs(travelY) > 1)
      setPositionY((value) => Math.max(-1, Math.min(1, value + (event.clientY - drag.current!.y) * canvas.current!.height / rect.height * 2 / travelY)))
    drag.current = { x: event.clientX, y: event.clientY }
  }

  const confirm = () => {
    if (!canvas.current) return
    canvas.current.toBlob((blob) => {
      if (!blob) return
      onConfirm(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
        type: 'image/jpeg', lastModified: Date.now(),
      }))
    }, 'image/jpeg', 0.9)
  }

  return (
    <Modal
      title={title}
      wide
      onClose={onCancel}
      actions={<>
        <button type="button" className="button secondary" onClick={onCancel}>キャンセル</button>
        <button type="button" className="button primary" disabled={!ready} onClick={confirm}>この範囲で確定</button>
      </>}
    >
      <p className="muted">画像をドラッグして表示位置を調整できます。</p>
      {imageError && <p className="notice error" role="alert">{imageError}</p>}
      <div className={`image-crop-workspace ${previewTarget ? 'with-guide' : ''}`}>
      <section className="image-crop-original" aria-label="保存する画像の調整">
        {previewTarget && <h3>保存する画像</h3>}
      <canvas
        ref={canvas}
        className="image-crop-canvas"
        width={outputWidth}
        height={canvasHeight}
        onPointerDown={(event) => {
          drag.current = { x: event.clientX, y: event.clientY }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={move}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
      />
      </section>
      {previewTarget && (previewSource ? <PageImageGuide target={previewTarget} source={previewSource} /> : <p className="muted" role="status">プレビューを準備しています…</p>)}
      </div>
      <div className="image-crop-controls">
        <label>拡大率
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
        <label>横位置
          <input type="range" min="-1" max="1" step="0.01" value={positionX} onChange={(event) => setPositionX(Number(event.target.value))} />
        </label>
        <label>縦位置
          <input type="range" min="-1" max="1" step="0.01" value={positionY} onChange={(event) => setPositionY(Number(event.target.value))} />
        </label>
      </div>
    </Modal>
  )
}
