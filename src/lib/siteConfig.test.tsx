import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSiteConfig } from './siteConfig'
const mocks = vi.hoisted(() => ({ local: vi.fn() }))
vi.mock('./localPageImages', () => ({ loadLocalPageImages: () => mocks.local(), localPageImagesUpdatedEvent: 'local-page-images-updated' }))
const config = { loginImage: 'images/new-login.jpg', entryImage: 'images/new-entry.jpg' }
beforeEach(() => {
  vi.stubEnv('DEV', true)
  mocks.local.mockReset().mockResolvedValue(null)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => config }))
  let serial = 0
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => `blob:local-${++serial}`), revokeObjectURL: vi.fn() })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('useSiteConfig', () => {
  it('DEVキャッシュの解決中に既定画像や公開画像を出さない', async () => {
    let resolve!: (value: { eventId: string; login: Blob; entry: Blob }) => void
    mocks.local.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const { result } = renderHook(() => useSiteConfig())
    expect(result.current.loading).toBe(true)
    expect(result.current.loginImage).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
    await act(async () => resolve({ eventId: 'new', login: new Blob(['login']), entry: new Blob(['entry']) }))
    expect(result.current.loginImage).toBe('blob:local-1')
    expect(result.current.loading).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('キャッシュなしならJSONを取得し、取得失敗は画像を非表示にする', async () => {
    const { result } = renderHook(() => useSiteConfig())
    await waitFor(() => expect(result.current.loginImage).toBe(config.loginImage))
    expect(fetch).toHaveBeenCalledWith('/site-config.json', expect.objectContaining({ cache: 'no-store' }))
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    await act(async () => window.dispatchEvent(new Event('local-page-images-updated')))
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.loginImage).toBeUndefined()
  })
  it('遅れた旧設定で更新後の画像を上書きしない', async () => {
    let resolve!: (value: unknown) => void
    mocks.local.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const { result } = renderHook(() => useSiteConfig())
    await act(async () => window.dispatchEvent(new Event('local-page-images-updated')))
    await waitFor(() => expect(result.current.loginImage).toBe(config.loginImage))
    await act(async () => resolve({ eventId: 'old', login: new Blob(), entry: new Blob() }))
    expect(result.current.loginImage).toBe(config.loginImage)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it('本番ではローカル画像キャッシュを参照しない', async () => {
    vi.stubEnv('DEV', false)
    const { result } = renderHook(() => useSiteConfig())
    await waitFor(() => expect(result.current.loginImage).toBe(config.loginImage))
    expect(mocks.local).not.toHaveBeenCalled()
  })
})
