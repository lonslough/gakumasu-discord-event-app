import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  compress: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('./imageCompression', () => ({
  compressImageForUpload: mocks.compress,
}))

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mocks.upload, remove: mocks.remove }),
    },
    from: () => ({ upsert: mocks.upsert }),
  },
}))

import {
  createInitialEntryValues,
  entryValuesFromSubmission,
  getSettingsRefreshDelay,
  saveEntry,
} from './entryService'
import type { Submission } from '../types'

const existingSubmission: Submission = {
  id: 'submission-id',
  user_id: 'user-id',
  discord_username: 'discord',
  producer_name: 'producer',
  category: 'sena',
  entry_division: 'beginner',
  score_image_path: 'user-id/score/old-result.jpg',
  deck_image_path: null,
  beginner_proof_image_path: 'user-id/beginner-proof/old-proof.jpg',
  login_days_proof_image_path: 'user-id/login-days-proof/old-proof.jpg',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

describe('entry values', () => {
  it('creates independent empty values', () => {
    const first = createInitialEntryValues()
    const second = createInitialEntryValues()

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })

  it('maps a submission back to editable values without stale files', () => {
    expect(entryValuesFromSubmission(existingSubmission)).toEqual({
      discordUsername: 'discord',
      producerName: 'producer',
      category: 'sena',
      entryDivision: 'beginner',
      resultFile: null,
      beginnerProofFile: null,
      loginDaysProofFile: null,
    })
  })
})

describe('saveEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.compress.mockImplementation(async (file: File) => file)
    mocks.upload.mockResolvedValue({ error: null })
    mocks.remove.mockResolvedValue({ error: null })
    mocks.upsert.mockResolvedValue({ error: null })
  })

  it('switches the database reference before removing the old image', async () => {
    const resultFile = new File(['image'], 'result.jpg', {
      type: 'image/jpeg',
    })
    const values = {
      ...entryValuesFromSubmission(existingSubmission),
      resultFile,
    }

    await saveEntry({
      userId: existingSubmission.user_id,
      values,
      existing: existingSubmission,
    })

    expect(mocks.upload).toHaveBeenCalledOnce()
    expect(mocks.upsert).toHaveBeenCalledOnce()
    expect(mocks.remove).toHaveBeenCalledWith([
      existingSubmission.score_image_path,
    ])
    expect(mocks.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.remove.mock.invocationCallOrder[0],
    )
  })

  it('removes newly uploaded images when the database update fails', async () => {
    const resultFile = new File(['image'], 'result.jpg', {
      type: 'image/jpeg',
    })
    const values = {
      ...entryValuesFromSubmission(existingSubmission),
      resultFile,
    }
    mocks.upsert.mockResolvedValue({ error: new Error('database unavailable') })

    await expect(
      saveEntry({
        userId: existingSubmission.user_id,
        values,
        existing: existingSubmission,
      }),
    ).rejects.toThrow('database')

    const uploadedPath = mocks.upload.mock.calls[0][0] as string
    expect(mocks.remove).toHaveBeenCalledWith([uploadedPath])
    expect(mocks.remove).not.toHaveBeenCalledWith([
      existingSubmission.score_image_path,
    ])
  })
})

describe('getSettingsRefreshDelay', () => {
  it('refreshes just after the opening boundary', () => {
    expect(
      getSettingsRefreshDelay(
        '2026-08-01T00:00:00Z',
        '2026-08-01T00:01:00Z',
        '2026-08-01T01:00:00Z',
      ),
    ).toBe(61_000)
  })

  it('refreshes just after the closing boundary', () => {
    expect(
      getSettingsRefreshDelay(
        '2026-08-01T00:30:00Z',
        '2026-08-01T00:00:00Z',
        '2026-08-01T01:00:00Z',
      ),
    ).toBe(1_801_000)
  })

  it('does not schedule after the final boundary', () => {
    expect(
      getSettingsRefreshDelay(
        '2026-08-01T01:00:01Z',
        '2026-08-01T00:00:00Z',
        '2026-08-01T01:00:00Z',
      ),
    ).toBeNull()
  })

  it('caps delays at the browser timeout maximum', () => {
    expect(
      getSettingsRefreshDelay(
        '2026-08-01T00:00:00Z',
        '2027-08-01T00:00:00Z',
        null,
      ),
    ).toBe(2_147_483_647)
  })
})
