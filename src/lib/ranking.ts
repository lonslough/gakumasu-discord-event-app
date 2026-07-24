import type { AdminSubmission } from '../types'

export function rankedByCategory(rows: AdminSubmission[], category: 'sena' | 'tsubame'): AdminSubmission[] {
  return rows
    .filter(
      (row) =>
        row.category === category &&
        row.review?.verification_status === 'verified' &&
        row.review.confirmed_score !== null,
    )
    .sort((a, b) => {
      const scoreDifference = (b.review?.confirmed_score ?? 0) - (a.review?.confirmed_score ?? 0)
      return scoreDifference || new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    })
}
