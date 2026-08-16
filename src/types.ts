export type Role = 'user' | 'admin'
export type Category = string

export interface CharacterOption {
  id: string
  name: string
  shortName: string
  enabled: boolean
}

export interface EventSettings {
  event_id: string
  event_name: string
  rules_description: string
  submission_start_at: string | null
  submission_end_at: string | null
  server_now: string
  accepting_submissions: boolean
  character_options: CharacterOption[]
}

export interface EventEdition {
  id: string
  name: string
  rules_description: string
  submission_start_at: string | null
  submission_end_at: string | null
  character_options: CharacterOption[]
  is_active: boolean
  created_at: string
  updated_at: string
}
export type EntryDivision = 'open' | 'switch_off' | 'beginner'
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
  event_id: string
  user_id: string
  discord_username: string
  producer_name: string
  category: Category
  entry_division: EntryDivision
  score_image_path: string | null
  deck_image_path: string | null
  beginner_proof_image_path: string | null
  login_days_proof_image_path: string | null
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
