import { compressImageForUpload } from './imageCompression'
import { supabase } from './supabase'
import { fileExtension, type EntryValues } from './validation'
import type { EntryDivision, Submission } from '../types'

export const submissionImagesBucket = 'submission-images'

export type SubmissionImageKind =
  | 'score'
  | 'beginner-proof'
  | 'login-days-proof'

export const createInitialEntryValues = (): EntryValues => ({
  discordUsername: '',
  producerName: '',
  category: '',
  entryDivision: '',
  resultFile: null,
  beginnerProofFile: null,
  loginDaysProofFile: null,
})

export const entryValuesFromSubmission = (
  submission: Submission,
): EntryValues => ({
  discordUsername: submission.discord_username,
  producerName: submission.producer_name,
  category: submission.category,
  entryDivision: submission.entry_division,
  resultFile: null,
  beginnerProofFile: null,
  loginDaysProofFile: null,
})

export function getSettingsRefreshDelay(
  serverNowValue: string,
  startValue: string | null,
  endValue: string | null,
): number | null {
  const serverNow = new Date(serverNowValue).getTime()
  const start = startValue ? new Date(startValue).getTime() : null
  const end = endValue ? new Date(endValue).getTime() : null
  let boundary: number | null = null
  if (start && serverNow < start) boundary = start
  else if (end && serverNow <= end) boundary = end

  if (!boundary) return null
  return Math.min(
    Math.max(boundary - serverNow + 1000, 1000),
    2_147_483_647,
  )
}

async function uploadSubmissionImage(
  userId: string,
  file: File,
  kind: SubmissionImageKind,
): Promise<string> {
  let compressed: File
  try {
    compressed = await compressImageForUpload(file)
  } catch {
    throw new Error('compression')
  }

  const path = `${userId}/${kind}/${crypto.randomUUID()}.${fileExtension(compressed.name)}`
  const { error } = await supabase.storage
    .from(submissionImagesBucket)
    .upload(path, compressed, {
      contentType: compressed.type,
      cacheControl: '3600',
      upsert: false,
    })
  if (error) throw new Error('upload')
  return path
}

interface SaveEntryInput {
  userId: string
  eventId: string
  values: EntryValues
  existing: Submission | null
}

async function resolveResultPath(
  userId: string,
  file: File | null,
  existing: Submission | null,
): Promise<string | null> {
  if (file) return uploadSubmissionImage(userId, file, 'score')
  if (existing?.deck_image_path) return null
  return existing?.score_image_path ?? null
}

async function resolveProofPath(
  userId: string,
  enabled: boolean,
  file: File | null,
  existingPath: string | null | undefined,
  kind: 'beginner-proof' | 'login-days-proof',
): Promise<string | null> {
  if (!enabled) return null
  if (file) return uploadSubmissionImage(userId, file, kind)
  return existingPath ?? null
}

export async function saveEntry({
  userId,
  eventId,
  values,
  existing,
}: SaveEntryInput): Promise<void> {
  const entryDivision = (existing?.entry_division ??
    values.entryDivision) as EntryDivision
  const uploaded: string[] = []

  try {
    const resultPath = await resolveResultPath(
      userId,
      values.resultFile,
      existing,
    )
    if (resultPath && values.resultFile) uploaded.push(resultPath)

    const isBeginner = entryDivision === 'beginner'
    const beginnerProofPath = await resolveProofPath(
      userId,
      isBeginner,
      values.beginnerProofFile,
      existing?.beginner_proof_image_path,
      'beginner-proof',
    )
    if (values.beginnerProofFile && beginnerProofPath)
      uploaded.push(beginnerProofPath)

    const loginDaysProofPath = await resolveProofPath(
      userId,
      isBeginner,
      values.loginDaysProofFile,
      existing?.login_days_proof_image_path,
      'login-days-proof',
    )
    if (values.loginDaysProofFile && loginDaysProofPath)
      uploaded.push(loginDaysProofPath)

    const { error } = await supabase.from('submissions').upsert(
      {
        user_id: userId,
        event_id: eventId,
        discord_username: values.discordUsername.trim(),
        producer_name: values.producerName.trim(),
        category: values.category,
        entry_division: entryDivision,
        score_image_path: resultPath,
        deck_image_path: null,
        beginner_proof_image_path: beginnerProofPath,
        login_days_proof_image_path: loginDaysProofPath,
      },
      { onConflict: 'event_id,user_id' },
    )
    if (error) throw new Error('database')

    const oldPaths = [
      values.resultFile || existing?.deck_image_path
        ? existing?.score_image_path
        : null,
      existing?.deck_image_path,
      values.beginnerProofFile ||
      (entryDivision !== 'beginner' && existing?.beginner_proof_image_path)
        ? existing?.beginner_proof_image_path
        : null,
      values.loginDaysProofFile ||
      (entryDivision !== 'beginner' && existing?.login_days_proof_image_path)
        ? existing?.login_days_proof_image_path
        : null,
    ].filter((path): path is string => Boolean(path))

    if (oldPaths.length)
      await supabase.storage.from(submissionImagesBucket).remove(oldPaths)
  } catch (error) {
    if (uploaded.length)
      await supabase.storage.from(submissionImagesBucket).remove(uploaded)
    throw error
  }
}
