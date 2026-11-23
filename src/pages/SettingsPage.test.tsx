import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import type { EventEdition } from '../types'
import { unzipSync } from 'fflate'
import { uploadPageImages } from '../components/settings/PageImageSettings'

afterEach(cleanup)

const mocks = vi.hoisted(() => ({
  events: [] as EventEdition[],
  upload: vi.fn(),
  rpc: vi.fn(),
  cache: vi.fn(),
  compress: vi.fn(),
  updateCounter: 0,
  download: vi.fn(),
  savedLogin: null as Blob | null,
  savedEntry: null as Blob | null,
  updateError: false,
  insert: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'admin-id' } } }),
}))

vi.mock('../lib/imageCompression', () => ({
  compressImageForUpload: (file: File) => mocks.compress(file),
}))

vi.mock('../components/settings/ImageCropModal', () => ({
  ImageCropModal: ({ file, onConfirm }: { file: File; onConfirm: (file: File) => void }) => (
    <div role="dialog" aria-label="画像調整">
      <button type="button" onClick={() => onConfirm(file)}>この範囲で確定</button>
    </div>
  ),
}))

vi.mock('../lib/localPageImages', () => ({
  cacheLocalPageImages: (...args: unknown[]) => mocks.cache(...args),
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
    rpc: (...args: unknown[]) => mocks.rpc(...args),
    from: (table: string) => {
      if (table !== 'event_editions') throw new Error(`unexpected table: ${table}`)
      return {
        select: () => ({
          order: async () => ({ data: mocks.events.map((event) => ({ ...event })), error: null }),
        }),
        update: (values: Partial<EventEdition>) => ({
          eq: async (_column: string, id: string) => {
            if (mocks.updateError) return { error: new Error('update failed') }
            const target = mocks.events.find((event) => event.id === id)
            if (target) Object.assign(target, values, { updated_at: `2026-10-11T01:00:${String(++mocks.updateCounter).padStart(2, '0')}Z` })
            return { error: null }
          },
        }),
        insert: (values: Partial<EventEdition>) => ({ select: () => ({ single: () => mocks.insert(values) }) }),
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
  ranking_published: false,
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
    vi.stubGlobal('Image', class {
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
      decode() { return Promise.resolve() }
    })
    mocks.rpc.mockReset().mockResolvedValue({ error: null })
    mocks.cache.mockReset().mockResolvedValue(undefined)
    mocks.updateCounter = 0
    mocks.compress.mockReset()
    mocks.compress.mockImplementation(async (file: File) => file)
    mocks.upload.mockReset()
    mocks.upload.mockResolvedValue({ error: null })
    mocks.download.mockReset()
    mocks.savedLogin = new Blob(['saved-login-image'], { type: 'image/jpeg' })
    mocks.savedEntry = new Blob(['saved-entry-image'], { type: 'image/jpeg' })
    for (const blob of [mocks.savedLogin, mocks.savedEntry]) Object.defineProperty(blob, 'arrayBuffer', { value: async () => await readBlob(blob!) })
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
  it('回変更直後は両画像を隠し、別の回の遅延応答を破棄する', async () => {
    mocks.events[0].page_images_path = 'first.zip'
    mocks.events[1].page_images_path = 'second.zip'
    let serial = 0
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:preview-${++serial}`)
    const data = { login: mocks.savedLogin, entry: mocks.savedEntry }
    let resolve!: (value: unknown) => void
    mocks.download.mockImplementation((path: string) => path === 'second.zip' ? new Promise(done => { resolve = done }) : Promise.resolve({ data, error: null }))
    render(<SettingsPage />)
    await screen.findByAltText('ログインページ画像のプレビュー')
    const select = screen.getByLabelText('編集する開催回')
    fireEvent.change(select, { target: { value: mocks.events[1].id } })
    expect(screen.queryByAltText('ログインページ画像のプレビュー')).toBeNull()
    expect(screen.queryByAltText('回答入力画面画像のプレビュー')).toBeNull()
    expect(screen.getAllByRole('status', { name: '画像を読み込み中' })).toHaveLength(2)
    fireEvent.change(select, { target: { value: mocks.events[0].id } })
    const image = await screen.findByAltText('ログインページ画像のプレビュー')
    const source = image.getAttribute('src')
    await act(async () => resolve({ data, error: null }))
    expect(screen.getByAltText('ログインページ画像のプレビュー')).toHaveAttribute('src', source)
  })

  it('保存済み画像の取得失敗で公開画像を代用せずスケルトンを出す', async () => {
    mocks.events[0].page_images_path = 'broken.zip'
    mocks.download.mockRejectedValue(new Error('offline'))
    render(<SettingsPage />)
    await screen.findByText('保存済みページ画像の読み込みに失敗しました。')
    expect(screen.getAllByRole('status', { name: '画像を表示できません' })).toHaveLength(2)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('status', { name: '画像を読み込み中' })).toBeNull()
  })

  it('受付対象切替が失敗した場合は別開催回のキャッシュを書き込まない', async () => {
    mocks.events[1].page_images_path = 'second.zip'
    mocks.rpc.mockResolvedValue({ error: new Error('activation failed') })
    render(<SettingsPage />)
    fireEvent.change(await screen.findByLabelText('編集する開催回'), { target: { value: mocks.events[1].id } })
    fireEvent.click(screen.getByRole('button', { name: 'この開催回を回答受付対象にする' }))
    await screen.findByText('回答受付対象を切り替えられませんでした。')
    expect(mocks.rpc).toHaveBeenCalledWith('set_active_event', { p_event_id: mocks.events[1].id })
    expect(mocks.cache).not.toHaveBeenCalled()
  })

  it('受付対象切替の成功後に開催回ID付きで画像ペアをキャッシュする', async () => {
    mocks.events[1].page_images_path = 'second.zip'
    render(<SettingsPage />)
    fireEvent.change(await screen.findByLabelText('編集する開催回'), { target: { value: mocks.events[1].id } })
    fireEvent.click(screen.getByRole('button', { name: 'この開催回を回答受付対象にする' }))
    await screen.findByText('回答受付対象の開催回を切り替えました。')
    expect(mocks.cache).toHaveBeenCalledWith(mocks.savedLogin, mocks.savedEntry, mocks.events[1].id)
    expect(mocks.cache.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.rpc.mock.invocationCallOrder[0])
  })

})

describe('開催回のランキング公開設定', () => {
  beforeEach(() => {
    mocks.events = [event('first', '一つ目', true), event('second', '二つ目', false)]
    mocks.events[1].ranking_published = true
    mocks.updateError = false
    mocks.insert.mockReset()
    mocks.insert.mockImplementation(async (values: Partial<EventEdition>) => {
      mocks.events.push({ ...event('new-event', '新規', false), ...values })
      return { data: { id: 'new-event' }, error: null }
    })
  })
  afterEach(() => { mocks.updateError = false })

  it('保存前は反映せず、保存後は再訪しても公開設定を表示する', async () => {
    const view = render(<SettingsPage />)
    await waitFor(() => expect(screen.getByLabelText('開催回の名称')).toHaveValue('一つ目'))
    const checkbox = await screen.findByRole('checkbox', { name: 'ランキングを公開する' })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(mocks.events[0].ranking_published).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('設定を保存しました。')
    expect(mocks.events[0].ranking_published).toBe(true)
    view.unmount()
    render(<SettingsPage />)
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'ランキングを公開する' })).toBeChecked())
  })

  it('開催回を切り替えると未保存の変更を破棄し保存済みの設定を表示する', async () => {
    render(<SettingsPage />)
    await waitFor(() => expect(screen.getByLabelText('開催回の名称')).toHaveValue('一つ目'))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'ランキングを公開する' }))
    const select = screen.getByLabelText('編集する開催回')
    fireEvent.change(select, { target: { value: 'second' } })
    expect(screen.getByRole('checkbox', { name: 'ランキングを公開する' })).toBeChecked()
    fireEvent.change(select, { target: { value: 'first' } })
    expect(screen.getByRole('checkbox', { name: 'ランキングを公開する' })).not.toBeChecked()
  })

  it('保存失敗時に選択を保持し公開済みとは扱わない', async () => {
    mocks.updateError = true
    render(<SettingsPage />)
    await waitFor(() => expect(screen.getByLabelText('開催回の名称')).toHaveValue('一つ目'))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'ランキングを公開する' }))
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('設定の保存に失敗しました。')
    expect(screen.getByRole('checkbox', { name: 'ランキングを公開する' })).toBeChecked()
    expect(mocks.events[0].ranking_published).toBe(false)
  })

  it('新規回の初期値は非公開で、公開を指定して作成できる', async () => {
    render(<SettingsPage />)
    await waitFor(() => expect(screen.getByLabelText('開催回の名称')).toHaveValue('一つ目'))
    const select = await screen.findByLabelText('編集する開催回')
    fireEvent.change(select, { target: { value: '__new__' } })
    expect(screen.getByRole('checkbox', { name: 'ランキングを公開する' })).not.toBeChecked()
    fireEvent.change(screen.getByLabelText('開催回の名称'), { target: { value: '公開する新規回' } })
    fireEvent.change(screen.getByLabelText('キャラクター 1'), { target: { value: 'saki' } })
    fireEvent.change(screen.getByLabelText('キャラクター 2'), { target: { value: 'temari' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'ランキングを公開する' }))
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('新しい開催回を作成しました。')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ name: '公開する新規回', ranking_published: true }))
  })
})


async function readBlob(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

describe('保存済みページ画像の片側更新', () => {
  beforeEach(() => {
    mocks.events = [event('current', '画像設定の検査', false)]
    mocks.events[0].page_images_path = 'current/page-images.zip'
    vi.stubGlobal('Image', class {
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
      decode() { return Promise.resolve() }
    })
    mocks.rpc.mockReset().mockResolvedValue({ error: null })
    mocks.cache.mockReset().mockResolvedValue(undefined)
    mocks.updateCounter = 0
    mocks.compress.mockReset()
    mocks.compress.mockImplementation(async (file: File) => file)
    mocks.upload.mockReset()
    mocks.upload.mockResolvedValue({ error: null })
    mocks.download.mockReset()
    mocks.savedLogin = new Blob([new Uint8Array([255, 0, 19, 240])], { type: 'image/jpeg' })
    mocks.savedEntry = new Blob([new Uint8Array([0, 222, 18, 111])], { type: 'image/jpeg' })
    for (const blob of [mocks.savedLogin, mocks.savedEntry]) Object.defineProperty(blob, 'arrayBuffer', { value: () => readBlob(blob!) })
    mocks.download.mockResolvedValue({ data: { login: mocks.savedLogin, entry: mocks.savedEntry }, error: null })
    let nextUrl = 0
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:preview-' + ++nextUrl), revokeObjectURL: vi.fn() })
  })

  it.each(['login', 'entry'] as const)('%sだけを設定全体と保存し、未変更側のバイト列を保持して同一パスのプレビューを更新する', async target => {
    render(<SettingsPage />)
    const savedPreview = await screen.findByAltText('ログインページ画像のプレビュー')
    await waitFor(() => expect(mocks.download).toHaveBeenCalled())
    const originalUrl = savedPreview.getAttribute('src')
    const unchangedBytes = new Uint8Array(await readBlob(target === 'login' ? mocks.savedEntry! : mocks.savedLogin!))
    const changedFile = imageFile('changed-' + target + '.jpg')
    fireEvent.change(screen.getByLabelText(target === 'login' ? 'ログインページ画像' : '回答入力画面画像'), { target: { files: [changedFile] } })
    fireEvent.click(await screen.findByRole('button', { name: 'この範囲で確定' }))
    mocks.compress.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('設定を保存しました。')
    const zip = unzipSync(new Uint8Array(await readBlob(mocks.upload.mock.calls[0][1])))
    const other = target === 'login' ? 'entry' : 'login'
    expect([...zip[`images/page/${other}.jpg`]]).toEqual([...unchangedBytes])
    expect(new TextDecoder().decode(zip[`images/page/${target}.jpg`])).toBe('image')
    expect(JSON.parse(new TextDecoder().decode(zip['site-config.json']))).toEqual({ loginImage: 'images/page/login.jpg', entryImage: 'images/page/entry.jpg' })
    expect(mocks.compress).toHaveBeenCalledTimes(1)
    expect(mocks.compress).toHaveBeenCalledWith(changedFile)
    await waitFor(() => expect(screen.getByAltText('ログインページ画像のプレビュー').getAttribute('src')).not.toBe(originalUrl))
    expect(mocks.events[0].page_images_path).toBe('current/page-images.zip')
    expect(mocks.download.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('未変更側の取得失敗時はZIPを上書きせず部分成功を通知する', async () => {
    render(<SettingsPage />)
    await screen.findByAltText('ログインページ画像のプレビュー')
    fireEvent.change(screen.getByLabelText('ログインページ画像'), { target: { files: [imageFile('replacement.jpg')] } })
    fireEvent.click(await screen.findByRole('button', { name: 'この範囲で確定' }))
    mocks.download.mockResolvedValue({ data: null, error: new Error('storage unavailable') })
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('開催回の設定は保存しましたが、ページ画像をStorageへ保存できませんでした。')
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('画像保存済みでない回の片側選択は設定保存前に拒否する', async () => {
    mocks.events[0].page_images_path = null
    render(<SettingsPage />)
    await screen.findByLabelText('編集する開催回')
    fireEvent.change(screen.getByLabelText('ログインページ画像'), { target: { files: [imageFile('first.jpg')] } })
    fireEvent.click(await screen.findByRole('button', { name: 'この範囲で確定' }))
    fireEvent.click(screen.getByRole('button', { name: '設定を保存' }))
    await screen.findByText('ページ画像はログインページ用と回答入力画面用の両方を選択してください。')
    expect(mocks.updateCounter).toBe(0)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('保存済みパスなしの片側更新と画像未指定はZIP保存前に拒否する', async () => {
    await expect(uploadPageImages('current', { login: imageFile('login.jpg'), entry: null }, false)).rejects.toThrow('page_images_incomplete')
    await expect(uploadPageImages('current', { login: null, entry: null }, false, 'current/page-images.zip')).rejects.toThrow('page_images_incomplete')
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})

describe('開催回を跨ぐ画像プレビュー', () => {
  it('前の開催回の遅延応答を破棄し、不要な画像URLを作らない', async () => {
    mocks.events = [event('first', '一つ目', false), event('second', '二つ目', false)]
    mocks.events[0].page_images_path = 'first/page-images.zip'
    mocks.events[1].page_images_path = 'second/page-images.zip'
    const pair = { login: new Blob(['login']), entry: new Blob(['entry']) }
    let release!: () => void
    mocks.download.mockReset()
    mocks.download.mockImplementation((path: string) => path === 'first/page-images.zip'
      ? new Promise(resolve => { release = () => resolve({ data: pair, error: null }) })
      : Promise.resolve({ data: pair, error: null }))
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:second'), revokeObjectURL: vi.fn() })
    render(<SettingsPage />)
    const select = await screen.findByLabelText('編集する開催回')
    await waitFor(() => expect(mocks.download).toHaveBeenCalledWith('first/page-images.zip'))
    fireEvent.change(select, { target: { value: 'second' } })
    await screen.findByAltText('ログインページ画像のプレビュー')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    await act(async () => { release() })
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2)
    expect(screen.getByAltText('ログインページ画像のプレビュー')).toHaveAttribute('src', 'blob:second')
  })
})
