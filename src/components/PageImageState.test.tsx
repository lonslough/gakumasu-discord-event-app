import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PageImage } from './PageImageState'

let images: { onload: null | (() => void); onerror: null | (() => void); src: string; decode: ReturnType<typeof vi.fn> }[]
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const response = () => ({ ok: true, blob: async () => new Blob(['image']) })

beforeEach(() => {
  images = []
  vi.stubGlobal('Image', class {
    onload = null
    onerror = null
    src = ''
    decode = vi.fn().mockResolvedValue(undefined)
    constructor() { images.push(this) }
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()))
  let serial = 0
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => `blob:image-${++serial}`), revokeObjectURL: vi.fn() })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function finish(index: number) {
  await waitFor(() => expect(images[index]?.src).toBeTruthy())
  await act(async () => { images[index].onload?.() })
}

describe('PageImage', () => {
  it('HTTP画像をキャッシュせず取得し、decode完了まで画像を表示しない', async () => {
    render(<PageImage source="/title.jpg" alt="タイトル" />)
    expect(screen.getByRole('status', { name: '画像を読み込み中' })).toHaveTextContent('')
    expect(screen.queryByRole('img')).toBeNull()
    await waitFor(() => expect(images[0].src).toBeTruthy())
    const decode = deferred<void>()
    images[0].decode.mockReturnValue(decode.promise)
    await act(async () => { images[0].onload?.() })
    expect(screen.queryByRole('img')).toBeNull()
    await act(async () => { decode.resolve() })
    expect(screen.getByAltText('タイトル')).toHaveAttribute('src', 'blob:image-1')
    expect(fetch).toHaveBeenCalledWith('/title.jpg', expect.objectContaining({ cache: 'no-store' }))
  })

  it('別開催回への切替直後に前の画像を隠し、遅延応答を破棄する', async () => {
    const oldFetch = deferred<ReturnType<typeof response>>()
    vi.mocked(fetch).mockImplementationOnce(() => oldFetch.promise as unknown as Promise<Response>)
    const view = render(<PageImage source="/old.jpg" alt="画像" />)
    view.rerender(<PageImage source="/new.jpg" alt="画像" />)
    await finish(1)
    const newUrl = screen.getByAltText('画像').getAttribute('src')
    await act(async () => { oldFetch.resolve(response()) })
    expect(screen.getByAltText('画像')).toHaveAttribute('src', newUrl)
    view.rerender(<PageImage source="/third.jpg" alt="画像" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(newUrl)
  })

  it('画像を隠した後に同じURLへ戻っても失効したBlobを表示しない', async () => {
    const view = render(<PageImage source="/same.jpg" alt="画像" />)
    await finish(0)
    view.rerender(<PageImage alt="画像" />)
    view.rerender(<PageImage source="/same.jpg" alt="画像" />)
    expect(screen.queryByRole('img')).toBeNull()
    await finish(1)
    expect(screen.getByAltText('画像')).toHaveAttribute('src', 'blob:image-2')
  })

  it('取得失敗・デコード失敗はスピナーを止めスケルトンにする', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))
    const view = render(<PageImage source="/broken.jpg" alt="画像" />)
    expect(await screen.findByRole('status', { name: '画像を表示できません' })).toHaveClass('page-image-skeleton')
    expect(view.container.querySelector('.spinner')).toBeNull()
    view.rerender(<PageImage source="blob:invalid" alt="画像" />)
    await act(async () => { images[1].onerror?.() })
    expect(screen.getByRole('status', { name: '画像を表示できません' })).toHaveClass('page-image-skeleton')
    expect(screen.queryByRole('img')).toBeNull()
  })
})
