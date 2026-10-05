import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageCropModal } from './ImageCropModal'

const drawImage = vi.fn()

describe('ImageCropModal', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:source'),
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal('Image', class {
      naturalWidth = 2000
      naturalHeight = 1200
      onload: null | (() => void) = null
      set src(_value: string) { this.onload?.() }
    })
    drawImage.mockReset()
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage,
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => callback(
      new Blob(['cropped'], { type: 'image/jpeg' }),
    ))
  })

  it('初期状態では元画像全体を切り取らず中央へ表示する', async () => {
    render(
      <ImageCropModal
        file={new File(['source'], 'source.jpg', { type: 'image/jpeg' })}
        title="画像の調整"
        aspectRatio={16 / 9}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 50, 0, 1500, 900)
    })
  })

  it('比率未指定では元画像の比率を維持して余白を作らない', async () => {
    const { container } = render(
      <ImageCropModal
        file={new File(['source'], 'login.jpg', { type: 'image/jpeg' })}
        title="ログイン画像の調整"
        aspectRatio={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(container.querySelector('canvas')).toHaveAttribute('height', '960')
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 960)
    })
  })

  it('拡大率と位置を調整し、トリミング済みJPEGを確定できる', async () => {
    const confirm = vi.fn()
    render(
      <ImageCropModal
        file={new File(['source'], 'source.png', { type: 'image/png' })}
        title="画像の調整"
        aspectRatio={16 / 9}
        onCancel={vi.fn()}
        onConfirm={confirm}
      />,
    )

    fireEvent.change(screen.getByLabelText('拡大率'), { target: { value: '1.5' } })
    fireEvent.change(screen.getByLabelText('横位置'), { target: { value: '0.4' } })
    fireEvent.change(screen.getByLabelText('縦位置'), { target: { value: '-0.3' } })
    fireEvent.click(await screen.findByRole('button', { name: 'この範囲で確定' }))

    expect(confirm).toHaveBeenCalledOnce()
    const output = confirm.mock.calls[0][0] as File
    expect(output.name).toBe('source.jpg')
    expect(output.type).toBe('image/jpeg')
  })
})
