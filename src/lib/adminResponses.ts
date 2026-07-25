import type { AdminSubmission, Category, VerificationStatus } from '../types'

export type CategoryFilter = 'all' | Category
export type StatusFilter = 'all' | VerificationStatus
export type ResponseSort = 'updated' | 'created' | 'score' | 'name'

export interface ResponseStats {
  submitted: number
  unsubmitted: number
  verified: number
  byCategory: Record<Category, number>
}

const pendingStatus: VerificationStatus = 'pending'

export function hasResultImage(row: AdminSubmission): boolean {
  return Boolean(row.score_image_path && !row.deck_image_path)
}

function timestamp(value: string): number {
  return new Date(value).getTime()
}

function matchesSearch(row: AdminSubmission, query: string): boolean {
  if (!query) return true

  return [row.discord_username, row.producer_name, row.profile.user_id].some(
    (value) => value.toLowerCase().includes(query),
  )
}

function matchesFilters(
  row: AdminSubmission,
  category: CategoryFilter,
  status: StatusFilter,
): boolean {
  const matchesCategory = category === 'all' || row.category === category
  const matchesStatus =
    status === 'all' ||
    (row.review?.verification_status ?? pendingStatus) === status
  return matchesCategory && matchesStatus
}

function compareResponses(
  first: AdminSubmission,
  second: AdminSubmission,
  sort: ResponseSort,
): number {
  switch (sort) {
    case 'created':
      return timestamp(second.created_at) - timestamp(first.created_at)
    case 'score':
      return (
        (second.review?.confirmed_score ?? -Infinity) -
        (first.review?.confirmed_score ?? -Infinity)
      )
    case 'name':
      return first.discord_username.localeCompare(second.discord_username, 'ja')
    case 'updated':
      return timestamp(second.updated_at) - timestamp(first.updated_at)
  }
}

export function filterAndSortResponses(
  rows: AdminSubmission[],
  search: string,
  category: CategoryFilter,
  status: StatusFilter,
  sort: ResponseSort,
): AdminSubmission[] {
  const query = search.trim().toLowerCase()

  return rows
    .filter(
      (row) =>
        matchesSearch(row, query) && matchesFilters(row, category, status),
    )
    .sort((first, second) => compareResponses(first, second, sort))
}

export function getResponseStats(
  rows: AdminSubmission[],
  registered: number,
): ResponseStats {
  const byCategory: Record<Category, number> = { sena: 0, tsubame: 0 }
  let verified = 0

  for (const row of rows) {
    byCategory[row.category] += 1
    if (row.review?.verification_status === 'verified') verified += 1
  }

  return {
    submitted: rows.length,
    unsubmitted: Math.max(0, registered - rows.length),
    verified,
    byCategory,
  }
}

export function parseConfirmedScore(value: string): number | null {
  if (!value.trim()) return null

  const score = Number(value)
  return Number.isSafeInteger(score) && score >= 0 ? score : null
}

export function isValidConfirmedScore(value: string): boolean {
  return !value.trim() || parseConfirmedScore(value) !== null
}

export function csvCell(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}
