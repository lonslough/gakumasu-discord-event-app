import { describe, expect, it } from 'vitest'
import { rankedByCategoryAndDivision } from './ranking'
import type { AdminSubmission, EntryDivision } from '../types'

function row(
  id: string,
  score: number,
  updated: string,
  status: 'verified' | 'pending' = 'verified',
  entryDivision: EntryDivision = 'open',
): AdminSubmission {
  return {
    id,
    user_id: id,
    discord_username: id,
    producer_name: id,
    category: 'sena',
    entry_division: entryDivision,
    score_image_path: `${id}/score/a.jpg`,
    deck_image_path: `${id}/deck/a.jpg`,
    beginner_proof_image_path: null,
    login_days_proof_image_path: null,
    created_at: updated,
    updated_at: updated,
    profile: { user_id: id },
    review: {
      submission_id: id,
      confirmed_score: score,
      verification_status: status,
      admin_note: '',
      verified_at: updated,
      verified_by: null,
      updated_at: updated,
    },
  }
}

describe('ランキング', () => {
  it('確認済み評価値の降順に並べる', () =>
    expect(
      rankedByCategoryAndDivision(
        [row('low', 10, '2026-01-01'), row('high', 20, '2026-01-02')],
        'sena',
        'open',
      ).map((item) => item.id),
    ).toEqual(['high', 'low']))
  it('同点なら最終回答日時が早い方を上位にする', () =>
    expect(
      rankedByCategoryAndDivision(
        [row('late', 10, '2026-02-01'), row('early', 10, '2026-01-01')],
        'sena',
        'open',
      ).map((item) => item.id),
    ).toEqual(['early', 'late']))
  it('未確認を除外する', () =>
    expect(
      rankedByCategoryAndDivision(
        [row('pending', 100, '2026-01-01', 'pending')],
        'sena',
        'open',
      ),
    ).toEqual([]))
  it('指定した応募部門の回答だけを対象にする', () =>
    expect(
      rankedByCategoryAndDivision(
        [
          row('open', 10, '2026-01-01'),
          row('switch-off', 20, '2026-01-01', 'verified', 'switch_off'),
          row('beginner', 30, '2026-01-01', 'verified', 'beginner'),
        ],
        'sena',
        'switch_off',
      ).map((item) => item.id),
    ).toEqual(['switch-off']))
})
