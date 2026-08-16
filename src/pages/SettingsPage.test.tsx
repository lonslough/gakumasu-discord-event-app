import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import type { EventEdition } from '../types'

const mocks = vi.hoisted(() => ({
  events: [] as EventEdition[],
  upload: vi.fn(),
  download: vi.fn(),
  savedLogin: null as Blob | null,
  savedEntry: null as Blob | null,
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'admin-id' } } }),
}))

vi.mock('../lib/imageCompression', () => ({
  compressImageForUpload: async (file: File) => file,
}))

vi.mock('../components/settings/ImageCropModal', () => ({
  ImageCropModal: ({ file, onConfirm }: { file: File; onConfirm: (file: File) => void }) => (
    <div role="dialog" aria-label="画像調整">
      <button type="button" onClick={() => onConfirm(file)}>この範囲で確定</button>
    </div>
  ),
}))

vi.mock('../lib/localPageImages', () => ({
  cacheLocalPageImages: vi.fn(),
  cacheLocalPageImagesFromStorage: vi.fn(),
  downloadPageImages: async (path: string) => {
    const { data, error } = await mocks.download(path)
    if (error) throw error
    return data
  },
  loadLocalPageImages: async () => null,
  localPageImagesUpdatedEvent: 'local-page-images-updated',
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'event_editions') throw new Error(`unexpected table: ${table}`)
      return {
        select: () => ({
          order: async () => ({ data: mocks.events.map((event) => ({ ...event })), error: null }),
        }),
        update: (values: Partial<EventEdition>) => ({
          eq: async (_column: string, id: string) => {
            const target = mocks.events.find((event) => event.id === id)
            if (target) Object.assign(target, values)
            return { error: null }
          },
        }),
      }
    },
    storage: {
      from: () => ({ upload: mocks.upload, download: mocks.download }),
    },
  },
}))

const characters = [
  { id: 'amaya-tsubame', name: '雨夜 燕', shortName: '燕', enabled: true },
  { id: 'juo-sena', name: '十王 星南', shortName: '星南', enabled: true },
]

const event = (id: string, name: string, isActive: boolean): EventEdition => ({
  id,
  name,
  rules_description: '',
  submission_start_at: null,
  submission_end_at: null,
  character_options: characters,
  page_images_path: null,
  is_active: isActive,
  created_at: isActive ? '2026-01-01T00:00:00Z' : '2026-02-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

function imageFile(name: string) {
  const file = new File(['image'], name, { type: 'image/jpeg' })
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode('image').buffer,
  })
  return file
}

describe('SettingsPage ページ画像', () => {
  beforeEach(() => {
    mocks.events = [
      event('00000000-0000-0000-0000-000000000001', 'デフォルト開催回', true),
      event('00000000-0000-0000-0000-000000000002', '別の開催回', false),
    ]
    mocks.upload.mockReset()
    mocks.upload.mockResolvedValue({ error: null })
    mocks.download.mockReset()
    mocks.savedLogin = new Blob(['saved-login-image'], { type: 'image/jpeg' })
    mocks.savedEntry = new Blob(['saved-entry-image'], { type: 'image/jpeg' })
    mocks.download.mockResolvedValue({
      data: {
        login: mocks.savedLogin,
        entry: mocks.savedEntry,
      },
      error: null,
    })
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('別開催回へ保存した画像が、画面を離れて戻った後もプレビュー表示される', async () => {
    const firstVisit = render(<SettingsPage />)
    const editionSelect = await screen.findByLabelText('編集する開催回')
    fireEvent.change(editionSelect, {
      target: { value: '00000000-0000-0000-0000-000000000002' },
    })

    fireEvent.change(screen.getByLabelText('ログインページ画像'), {
      target: { files: [imageFile('login.jpg')] },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'この範囲で確定' }))
    fireEvent.change(screen.getByLabelText('回答入力画面画像'), {
      target: { files: [imageFile('entry.jpg')] },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'この範囲で確定' }))
    expect(screen.queryByRole('button', { name: 'ページ画像をStorageへ保存' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))

    await screen.findByText('設定を保存しました。')
    expect(mocks.upload).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000002/page-images.zip',
      expect.any(Blob),
      expect.objectContaining({ upsert: true }),
    )
    expect(mocks.events[1].page_images_path).toBe(
      '00000000-0000-0000-0000-000000000002/page-images.zip',
    )

    firstVisit.unmount()
    const otherScreen = render(<div>別画面</div>)
    expect(screen.getByText('別画面')).toBeInTheDocument()
    otherScreen.unmount()

    render(<SettingsPage />)
    const revisitedSelect = await screen.findByLabelText('編集する開催回')
    fireEvent.change(revisitedSelect, {
      target: { value: '00000000-0000-0000-0000-000000000002' },
    })

    await waitFor(() => {
      expect(screen.getByAltText('ログインページ画像のプレビュー')).toHaveAttribute('src', 'blob:preview')
      expect(screen.getByAltText('回答入力画面画像のプレビュー')).toHaveAttribute('src', 'blob:preview')
    })
    expect(mocks.download).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000002/page-images.zip',
    )
    expect(URL.createObjectURL).toHaveBeenCalledWith(mocks.savedLogin)
    expect(URL.createObjectURL).toHaveBeenCalledWith(mocks.savedEntry)
  })
})
