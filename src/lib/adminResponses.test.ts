import { describe, expect, it } from 'vitest'
import type { AdminSubmission } from '../types'
import {
  csvCell,
  filterAndSortResponses,
  getResponseStats,
  isValidConfirmedScore,
  parseConfirmedScore,
} from './adminResponses'

function submission(overrides: Partial<AdminSubmission> = {}): AdminSubmission {
  return {
    id: 'submission-1',
    user_id: 'auth-user-1',
    discord_username: 'Discord User',
    producer_name: 'Producer',
    category: 'sena',
    entry_division: 'open',
    score_image_path: 'score.png',
    deck_image_path: 'deck.png',
    beginner_proof_image_path: null,
    login_days_proof_image_path: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    profile: { user_id: 'public-user-1' },
    review: null,
    ...overrides,
  }
}

describe('filterAndSortResponses', () => {
  const verified = submission({
    id: 'verified',
    discord_username: 'Alpha',
    category: 'tsubame',
    updated_at: '2026-01-03T00:00:00.000Z',
    review: {
      submission_id: 'verified',
      confirmed_score: 100,
      verification_status: 'verified',
      admin_note: '',
      verified_at: '2026-01-03T00:00:00.000Z',
      verified_by: 'admin',
      updated_at: '2026-01-03T00:00:00.000Z',
    },
  })
  const pending = submission({
    id: 'pending',
    discord_username: 'Beta',
  })

  it('searches across participant identifiers', () => {
    expect(
      filterAndSortResponses([pending, verified], 'PUBLIC-USER', 'all', 'name'),
    ).toEqual([verified, pending])
  })

  it('filters by category or verification status', () => {
    expect(
      filterAndSortResponses([pending, verified], '', 'tsubame', 'updated'),
    ).toEqual([verified])
    expect(
      filterAndSortResponses([pending, verified], '', 'pending', 'updated'),
    ).toEqual([pending])
  })

  it('sorts missing scores after confirmed scores', () => {
    expect(
      filterAndSortResponses([pending, verified], '', 'all', 'score'),
    ).toEqual([verified, pending])
  })
})

describe('getResponseStats', () => {
  it('builds all dashboard counts in one pass', () => {
    const verified = submission({
      category: 'tsubame',
      review: {
        submission_id: 'submission-1',
        confirmed_score: 10,
        verification_status: 'verified',
        admin_note: '',
        verified_at: null,
        verified_by: null,
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    })

    expect(getResponseStats([verified], 3)).toEqual({
      submitted: 1,
      unsubmitted: 2,
      verified: 1,
      byCategory: { sena: 0, tsubame: 1 },
    })
  })
})

describe('confirmed score helpers', () => {
  it('accepts an empty value or a non-negative safe integer', () => {
    expect(parseConfirmedScore('')).toBeNull()
    expect(parseConfirmedScore('123')).toBe(123)
    expect(isValidConfirmedScore('0')).toBe(true)
  })

  it('rejects negative, fractional, and non-numeric values', () => {
    expect(isValidConfirmedScore('-1')).toBe(false)
    expect(isValidConfirmedScore('1.5')).toBe(false)
    expect(isValidConfirmedScore('score')).toBe(false)
  })
})

describe('csvCell', () => {
  it('quotes values and escapes embedded quotes', () => {
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell(null)).toBe('""')
  })
})
