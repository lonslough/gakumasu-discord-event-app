export type Role = 'user' | 'admin'
export type Category = 'seina' | 'tsubame'
export type VerificationStatus = 'pending' | 'verified' | 'invalid'

export interface Profile {
  id: string
  user_id: string
  role: Role
  created_at: string
  updated_at: string
}

export interface Submission {
  id: string
  user_id: string
  discord_username: string
  producer_name: string
  category: Category
  score_image_path: string
  deck_image_path: string
  created_at: string
  updated_at: string
}

export interface Review {
  submission_id: string
  confirmed_score: number | null
  verification_status: VerificationStatus
  admin_note: string
  verified_at: string | null
  verified_by: string | null
  updated_at: string
}

export interface AdminSubmission extends Submission {
  profile: Pick<Profile, 'user_id'>
  review: Review | null
}

export interface UserSummary extends Profile {
  has_submission: boolean
  last_submitted_at: string | null
}
