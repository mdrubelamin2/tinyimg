import { MAX_PIXELS } from '@/constants'

export function checkPixelLimit(width: number, height: number): void {
  const total = width * height
  if (total > MAX_PIXELS || !Number.isFinite(total)) {
    throw new Error(
      `Image dimensions too large (max ${Math.round(MAX_PIXELS / 1_000_000)} megapixels)`,
    )
  }
}

export async function getImageData(bitmap: ImageBitmap): Promise<ImageData> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Could not get 2d context')
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/** Normalize format for encoding: "jpg" -> "jpeg", "original" -> ext or webp. */
export function normalizeOutputFormat(requested: string, ext: string | undefined): string {
  if (requested === 'original') return ext === 'jpg' ? 'jpeg' : (ext ?? 'webp')
  return requested === 'jpg' ? 'jpeg' : requested
}

export async function resizeImage(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): Promise<ImageData> {
  const canvas = new OffscreenCanvas(width, height)
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2d context for resize')
    ctx.drawImage(bitmap, 0, 0, width, height)
    return ctx.getImageData(0, 0, width, height)
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

/** Native zero-memory-spike base64 encoding using FileReader */
export async function toBase64(buffer: ArrayBuffer): Promise<string> {
  const blob = new Blob([buffer])
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      if (base64) resolve(base64)
      else reject(new Error('Failed to parse base64 from Data URL'))
    })
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Normalize thrown values from WASM / codecs (often not `instanceof Error`). */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error == null) return fallback
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    const m = error.message?.trim()
    if (m) return m
    return error.name || fallback
  }
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error)
  }
  if (typeof error === 'object') {
    const o = error as Record<string, unknown>
    const msg = o['message']
    const detail = o['detail']
    const reason = o['reason']
    if (typeof msg === 'string' && msg.trim()) return msg.trim()
    if (typeof detail === 'string' && detail.trim()) return detail.trim()
    if (typeof reason === 'string' && reason.trim()) return reason.trim()
    try {
      const j = JSON.stringify(error)
      if (j && j !== '{}') return j
    } catch {
      /* ignore */
    }
    if (Object.keys(error as object).length === 0) {
      return `${fallback} (codec threw a non-Error value with no details)`
    }
  }
  const s = String(error)
  if (s && s !== '[object Object]') return s
  return fallback
}
