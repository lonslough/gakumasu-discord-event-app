import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLoginLayout } from './useLoginLayout'

let artworkWidth = 1536
let artworkHeight = 1024
let viewport: EventTarget & { height: number; offsetTop: number }

function Harness({ embedded }: { embedded?: { width: number; height: number } }) {
  const layout = useLoginLayout('sample.jpg', embedded)
  return <main ref={layout.pageRef} data-testid="page" style={{ height: layout.height, top: layout.top }}>
    <img ref={layout.imageRef} data-testid="art" onLoad={layout.onImageLoad} onError={layout.onImageLoad} style={{ width: layout.imageWidth, height: layout.imageHeight, left: layout.imageLeft }} />
    <section ref={layout.formWrapRef} style={{ paddingTop: 64, paddingBottom: 24 }}>
      <div ref={layout.contentRef}><input aria-label="入力保持" /></div>
    </section>
    <output data-testid="geometry">{JSON.stringify({ formTop: layout.formTop, fadeStart: layout.fadeStart, overlap: layout.imageOverlap, narrow: layout.narrow })}</output>
  </main>
}
const geometry = () => JSON.parse(screen.getByTestId('geometry').textContent!)
const art = () => screen.getByTestId('art') as HTMLImageElement
const resize = (width: number, height: number) => {
  window.innerWidth = width
  viewport.height = height
  fireEvent(window, new Event('resize'))
}

describe('タイトル画像の実画面・ガイド共通配置', () => {
  beforeEach(() => {
    artworkWidth = 1536; artworkHeight = 1024
    vi.stubGlobal('innerWidth', 1366)
    vi.stubGlobal('innerHeight', 768)
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    viewport = Object.assign(new EventTarget(), { height: 768, offsetTop: 0 })
    vi.stubGlobal('visualViewport', viewport)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(() => artworkWidth)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockImplementation(() => artworkHeight)
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(550)
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'visible'
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('画面高を満たす画像を幅の1/3に置き、マスクの開始位置をフォーム境界へ換算する', async () => {
    render(<Harness />)
    await waitFor(() => expect(art().style.width).toBe('1152px'))
    const left = parseFloat(art().style.left)
    expect(left + 1152 / 2).toBeCloseTo(1366 / 3)
    expect(art().style.height).toBe('768px')
    expect(left + geometry().fadeStart).toBeCloseTo(1366 * 0.55)
    expect(geometry().overlap).toBe(true)
    resize(1920, 1080)
    await waitFor(() => expect(art().style.left).toBe('-170px'))
    expect(parseFloat(art().style.left) + parseFloat(art().style.width) / 2).toBe(640)
  })

  it('縦長・横長でも縦横比と1/3の中心を保持し、フォームへ届く場合だけ透過する', async () => {
    render(<Harness />)
    artworkWidth = 600; artworkHeight = 1200
    fireEvent.load(art())
    await waitFor(() => expect(art().style.width).toBe('384px'))
    expect(parseFloat(art().style.left) + 192).toBeCloseTo(1366 / 3)
    expect(geometry().overlap).toBe(false)
    artworkWidth = 4000; artworkHeight = 1000
    fireEvent.load(art())
    await waitFor(() => expect(art().style.width).toBe('3072px'))
    expect(parseFloat(art().style.left) + 1536).toBeCloseTo(1366 / 3)
    expect(geometry().overlap).toBe(true)
  })

  it('900px以下は幅合わせ・左端0を維持し、高さが足りる場合は画像の直下にフォームを置く', async () => {
    render(<Harness />)
    resize(390, 1000)
    await waitFor(() => expect(art().style.width).toBe('390px'))
    expect(art().style.height).toBe('260px')
    expect(art().style.left).toBe('0px')
    expect(geometry()).toMatchObject({ formTop: 260, overlap: false, narrow: true })
    resize(390, 667)
    await waitFor(() => expect(geometry().overlap).toBe(true))
    expect(geometry().formTop).toBe(29)
    resize(901, 768)
    await waitFor(() => expect(geometry().narrow).toBe(false))
    expect(parseFloat(art().style.left) + 576).toBeCloseTo(901 / 3)
  })

  it('キーボード・画像読込失敗後も入力ノードを保持し、離脱時に文書スクロールを復元する', async () => {
    const view = render(<Harness />)
    resize(375, 667)
    const input = screen.getByLabelText('入力保持')
    fireEvent.change(input, { target: { value: '入力中' } })
    input.focus()
    viewport.height = 300; viewport.offsetTop = 20
    act(() => { viewport.dispatchEvent(new Event('resize')) })
    await waitFor(() => expect(screen.getByTestId('page')).toHaveStyle({ height: '300px', top: '20px' }))
    expect(geometry().formTop).toBe(0)
    expect(screen.getByLabelText('入力保持')).toBe(input)
    expect(input).toHaveValue('入力中')
    artworkWidth = 0; artworkHeight = 0
    fireEvent.error(art())
    expect(geometry().formTop).toBe(0)
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe('visible')
    expect(document.documentElement.style.overflow).toBe('auto')
  })

  it('ガイドは指定した仮想画面幅で計算し、親文書を固定しない', async () => {
    const view = render(<Harness embedded={{ width: 1366, height: 768 }} />)
    expect(document.body.style.overflow).toBe('visible')
    expect(parseFloat(art().style.left) + 576).toBeCloseTo(1366 / 3)
    view.rerender(<Harness embedded={{ width: 390, height: 844 }} />)
    await waitFor(() => expect(art().style.width).toBe('390px'))
    expect(screen.getByTestId('page')).toHaveStyle({ height: '844px' })
    expect(geometry().narrow).toBe(true)
    expect(document.body.style.overflow).toBe('visible')
  })
})
