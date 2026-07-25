import { describe, expect, it } from 'vitest'
import { rankedByCategory } from './ranking'
import type { AdminSubmission } from '../types'

function row(
  id: string,
  score: number,
  updated: string,
  status: 'verified' | 'pending' = 'verified',
): AdminSubmission {
  return {
    id,
    user_id: id,
    discord_username: id,
    producer_name: id,
    category: 'sena',
    score_image_path: `${id}/score/a.jpg`,
    deck_image_path: `${id}/deck/a.jpg`,
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
      rankedByCategory(
        [row('low', 10, '2026-01-01'), row('high', 20, '2026-01-02')],
        'sena',
      ).map((item) => item.id),
    ).toEqual(['high', 'low']))
  it('同点なら最終回答日時が早い方を上位にする', () =>
    expect(
      rankedByCategory(
        [row('late', 10, '2026-02-01'), row('early', 10, '2026-01-01')],
        'sena',
      ).map((item) => item.id),
    ).toEqual(['early', 'late']))
  it('未確認を除外する', () =>
    expect(
      rankedByCategory([row('pending', 100, '2026-01-01', 'pending')], 'sena'),
    ).toEqual([]))
})
