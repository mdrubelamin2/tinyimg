import type { LosslessEncoding } from '@/constants'

const SMALL_FILE_BYTES = 200 * 1024
const SMALL_PNG_BYTES = 100 * 1024
const HIGH_QUALITY_PERCENT = 92

export interface QuickProbeInput {
  format: string
  losslessEncoding?: LosslessEncoding
  originalSize: number
  qualityPercent: number
  sourceBuffer: ArrayBuffer
}

/** Skip full encode when input is already small and high-quality (heuristic). */
export async function shouldQuickProbeSkip(input: QuickProbeInput): Promise<boolean> {
  const fmt = input.format.toLowerCase()
  const bytes = new Uint8Array(input.sourceBuffer)

  if (fmt === 'avif' && isAvifBuffer(bytes)) return true

  if (
    fmt === 'png' &&
    isPngBuffer(bytes) &&
    input.originalSize <= SMALL_PNG_BYTES &&
    input.losslessEncoding !== 'none'
  ) {
    return true
  }

  if (input.originalSize > SMALL_FILE_BYTES) return false
  if (input.qualityPercent < HIGH_QUALITY_PERCENT) return false

  if (fmt === 'webp' && isWebpBuffer(bytes)) return true
  if ((fmt === 'jpeg' || fmt === 'jpg') && isJpegBuffer(bytes)) return true

  return false
}

function isAvifBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  )
}

function isJpegBuffer(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8
}

function isPngBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
}

function isWebpBuffer(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
}
