const SMALL_FILE_BYTES = 200 * 1024
const HIGH_QUALITY_PERCENT = 92

export interface QuickProbeInput {
  format: string
  originalSize: number
  qualityPercent: number
  sourceBuffer: ArrayBuffer
}

/** Skip full encode when input is already small and high-quality (heuristic). */
export async function shouldQuickProbeSkip(input: QuickProbeInput): Promise<boolean> {
  if (input.originalSize > SMALL_FILE_BYTES) return false
  if (input.qualityPercent < HIGH_QUALITY_PERCENT) return false

  const fmt = input.format.toLowerCase()
  if (fmt !== 'webp' && fmt !== 'jpeg' && fmt !== 'jpg') return false

  return true
}
