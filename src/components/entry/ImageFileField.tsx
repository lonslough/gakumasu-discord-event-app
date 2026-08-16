import { useEffect, useState } from 'react'
import { submissionImagesBucket } from '../../lib/entryService'
import { supabase } from '../../lib/supabase'

interface ExistingImage {
  name: string
  path: string
}

interface ImageFileFieldProps {
  id: string
  label: string
  file: File | null
  existing?: ExistingImage | null
  error?: string
  onChange: (file: File | null) => void
}

export function ImageFileField({
  id,
  label,
  file,
  existing,
  error,
  onChange,
}: ImageFileFieldProps) {
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null)
  const [showExisting, setShowExisting] = useState(false)
  const [existingUrl, setExistingUrl] = useState<string | null>(null)
  const [existingLoading, setExistingLoading] = useState(false)
  const [existingError, setExistingError] = useState('')

  let existingButtonLabel = '回答済み画像を確認する'
  if (existingLoading) existingButtonLabel = '読み込み中…'
  else if (showExisting) existingButtonLabel = '回答済み画像を閉じる'

  useEffect(() => {
    if (!file || !['image/jpeg', 'image/png'].includes(file.type)) {
      setSelectedPreview(null)
      return
    }
    const objectUrl = URL.createObjectURL(file)
    setSelectedPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  useEffect(() => {
    setShowExisting(false)
    setExistingUrl(null)
    setExistingError('')
  }, [existing?.path])

  const toggleExisting = async () => {
    if (showExisting) {
      setShowExisting(false)
      return
    }
    if (existingUrl) {
      setShowExisting(true)
      return
    }
    if (!existing) return
    setExistingLoading(true)
    setExistingError('')
    const { data, error: signedError } = await supabase.storage
      .from(submissionImagesBucket)
      .createSignedUrl(existing.path, 600)
    setExistingLoading(false)
    if (signedError) {
      setExistingError('回答済み画像を読み込めませんでした。')
      return
    }
    setExistingUrl(data.signedUrl)
    setShowExisting(true)
  }

  return (
    <div className="file-block">
      <div className="image-upload-column selected-image-column">
        <p className="image-column-title">選択した画像</p>
        <div className="image-column-actions">
          <div className="file-select-row">
            <label className="button secondary" htmlFor={id}>
              画像を選択
            </label>
            <input
              className="visually-hidden-file"
              id={id}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
              onChange={(event) => onChange(event.target.files?.[0] ?? null)}
            />
            <span className="selected-file-name">
              {file?.name ?? '未選択'}
            </span>
          </div>
          <small className="file-help">
            JPG / PNG / HEIC / HEIF・最大10MB（送信時に自動圧縮）
          </small>
        </div>
        <div className="image-column-media">
          {selectedPreview ? (
            <a href={selectedPreview} target="_blank" rel="noreferrer">
              <img
                className="entry-preview"
                src={selectedPreview}
                alt={`${label}の選択画像プレビュー`}
              />
            </a>
          ) : (
            <div className="image-placeholder">画像は未選択です</div>
          )}
        </div>
        {error && <p className="field-error">{error}</p>}
      </div>
      <div className="image-upload-column existing-image-column">
        <p className="image-column-title">回答済み画像</p>
        <div className="image-column-actions">
          {existing && (
            <button
              type="button"
              className="button secondary small"
              aria-expanded={showExisting}
              disabled={existingLoading}
              onClick={() => void toggleExisting()}
            >
              {existingButtonLabel}
            </button>
          )}
        </div>
        <div className="image-column-media">
          {existing && showExisting && existingUrl ? (
            <div className="existing-file">
              <a href={existingUrl} target="_blank" rel="noreferrer">
                <img
                  className="entry-preview"
                  src={existingUrl}
                  alt={`${label}の回答済み画像`}
                />
                <span>{existing.name}</span>
              </a>
            </div>
          ) : (
            <div className="image-placeholder">
              {existing
                ? 'ボタンを押すと表示します'
                : '回答済み画像はありません'}
            </div>
          )}
        </div>
        {existingError && <p className="field-error">{existingError}</p>}
      </div>
    </div>
  )
}
