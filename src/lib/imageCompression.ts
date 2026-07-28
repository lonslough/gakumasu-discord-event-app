const MAX_COMPRESSED_SIZE_MB = 1
const MAX_IMAGE_DIMENSION = 1920
const JPEG_QUALITY = 0.82

const isHeic = (file: File) =>
  ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'].includes(
    file.type.toLowerCase(),
  ) || /\.(heic|heif)$/i.test(file.name)

const jpegName = (name: string) => `${name.replace(/\.[^.]+$/, '') || 'image'}.jpg`

export async function compressImageForUpload(file: File): Promise<File> {
  let source = file

  if (isHeic(file)) {
    const { default: heic2any } = await import('heic2any')
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    })
    const jpeg = Array.isArray(converted) ? converted[0] : converted
    source = new File([jpeg], jpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  }

  const { default: imageCompression } = await import(
    'browser-image-compression'
  )
  const compressed = await imageCompression(source, {
    maxSizeMB: MAX_COMPRESSED_SIZE_MB,
    maxWidthOrHeight: MAX_IMAGE_DIMENSION,
    initialQuality: JPEG_QUALITY,
    fileType: 'image/jpeg',
    preserveExif: false,
    useWebWorker: true,
  })

  return new File([compressed], jpegName(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}
