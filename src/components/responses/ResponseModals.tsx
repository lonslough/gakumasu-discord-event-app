import type { VerificationStatus } from '../../types'
import { Modal } from '../Modal'

export interface SubmissionImage {
  url: string
  name: string
}

export interface ReviewImages {
  result?: SubmissionImage
  beginnerProof?: SubmissionImage
  loginDaysProof?: SubmissionImage
}

interface ReviewModalProps {
  score: string
  status: VerificationStatus
  note: string
  saving: boolean
  verificationDisabled: boolean
  images: ReviewImages
  imagesLoading: boolean
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
  verificationDisabled,
  images,
  imagesLoading,
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
      <section className="review-images">
        <h3>提出画像</h3>
        {imagesLoading ? (
          <div className="spinner" aria-label="画像を読み込み中" />
        ) : (
          <div className="review-image-grid">
            {(
              [
                ['評価値・最終所持スキルカード', images.result],
                ['PID・Pレベル', images.beginnerProof],
                ['ログイン日数', images.loginDaysProof],
              ] as const
            ).map(([label, image]) => (
              <div className="review-image card" key={label}>
                <strong>{label}</strong>
                {image ? (
                  <>
                    <a href={image.url} target="_blank" rel="noreferrer">
                      <img src={image.url} alt={`${label}画像`} />
                    </a>
                    <a
                      className="link-button"
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {image.name}を新しいタブで開く
                    </a>
                  </>
                ) : (
                  <span className="muted">未提出</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      {verificationDisabled && (
        <div className="notice warning">
          評価値・最終所持スキルカード画像が未提出のため、確認済み評価値と確認状態は編集できません。
        </div>
      )}
      <div className="review-grid">
        <label>
          確認済み評価値
          <input
            type="number"
            min="0"
            step="1"
            value={score}
            disabled={verificationDisabled}
            onChange={(event) => onScoreChange(event.target.value)}
          />
        </label>
        <label>
          確認状態
          <select
            value={status}
            disabled={verificationDisabled}
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
