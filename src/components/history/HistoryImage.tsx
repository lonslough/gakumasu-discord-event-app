import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export function HistoryImage({ path, label, initiallyOpen = false }: { path: string | null; label: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen)
  const [attempt, setAttempt] = useState(0)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setUrl('')
    setError('')
    if (open && path) {
      void (async () => {
        try {
          const { data, error: downloadError } = await supabase.storage
            .from('submission-images').download(path)
          if (downloadError || !data) throw downloadError ?? new Error('No image')
          if (cancelled) return
          objectUrl = URL.createObjectURL(data)
          setUrl(objectUrl)
        } catch {
          if (!cancelled) setError('画像を読み込めませんでした。再試行してください。')
        }
      })()
    }
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, path, attempt])

  return (
    <div className="history-image">
      {!path && <p className="muted">{label}：<span>未提出</span></p>}
      {path && (
        <button type="button" className="button secondary small"
          aria-expanded={open} onClick={() => setOpen(value => !value)}>
          {open ? `${label}を閉じる` : `${label}を表示`}
        </button>
      )}
      {open && path && (
        <div className="history-image-content">
          {!url && !error && <p role="status">画像を読み込み中…</p>}
          {error && <div role="alert">
            <p>{error}</p>
            <button type="button" className="button secondary small"
              onClick={() => setAttempt(value => value + 1)}>{label}を再試行</button>
          </div>}
          {url && !error && <a href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={`提出した${label}`}
              onError={() => setError('画像を表示できませんでした。再試行してください。')} />
            <span>画像を別タブで開く</span>
          </a>}
        </div>
      )}
    </div>
  )
}
