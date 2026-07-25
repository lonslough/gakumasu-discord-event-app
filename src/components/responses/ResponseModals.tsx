import type { VerificationStatus } from '../../types'
import { Modal } from '../Modal'

export interface SubmissionImage {
  url: string
  name: string
}

interface ReviewModalProps {
  score: string
  status: VerificationStatus
  note: string
  saving: boolean
  onScoreChange: (value: string) => void
  onStatusChange: (value: VerificationStatus) => void
  onNoteChange: (value: string) => void
  onSave: () => void
  onClose: () => void
}

export function ReviewModal({
  score,
  status,
  note,
  saving,
  onScoreChange,
  onStatusChange,
  onNoteChange,
  onSave,
  onClose,
}: ReviewModalProps) {
  return (
    <Modal
      title="回答の確認"
      wide
      onClose={onClose}
      actions={
        <>
          <button className="button secondary" onClick={onClose}>
            キャンセル
          </button>
          <button className="button primary" disabled={saving} onClick={onSave}>
            {saving ? '保存中…' : '保存'}
          </button>
        </>
      }
    >
      <div className="review-grid">
        <label>
          確認済み評価値
          <input
            type="number"
            min="0"
            step="1"
            value={score}
            onChange={(event) => onScoreChange(event.target.value)}
          />
        </label>
        <label>
          確認状態
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as VerificationStatus)
            }
          >
            <option value="pending">未確認</option>
            <option value="verified">確認済み</option>
            <option value="invalid">無効</option>
          </select>
        </label>
      </div>
      <label>
        管理者メモ
        <textarea
          rows={4}
          value={note}
          maxLength={1000}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </label>
    </Modal>
  )
}

interface ImageModalProps {
  image: SubmissionImage
  onClose: () => void
}

export function ImageModal({ image, onClose }: ImageModalProps) {
  return (
    <Modal
      title={image.name}
      wide
      onClose={onClose}
      actions={
        <a
          className="button primary"
          href={image.url}
          target="_blank"
          rel="noreferrer"
        >
          新しいタブで開く
        </a>
      }
    >
      <img className="large-image" src={image.url} alt={image.name} />
    </Modal>
  )
}
