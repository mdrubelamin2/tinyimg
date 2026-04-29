import type { ImageResult } from '@/lib/queue/types'

const DOWNLOAD_EXT_JPEG = 'jpg'

export function buildOptimizedDownloadFilename(baseName: string, result: ImageResult): string {
  const ext = fileExtensionForEncodeFormat(result.format)
  const stem = resultVariantStem(result)
  const body = stem ? `${baseName}-${stem}` : baseName
  return `tinyimg-${body}.${ext}`
}

export function fileExtensionForEncodeFormat(format: string): string {
  return format === 'jpeg' ? DOWNLOAD_EXT_JPEG : format
}

/** Non-empty suffix derived from `resultId` after the `__` separator (filesystem-safe). */
export function resultVariantStem(result: ImageResult): string {
  if (!result.resultId.includes('__')) return ''
  return result.resultId
    .split('__')
    .slice(1)
    .join('-')
    .replaceAll(/[^a-zA-Z0-9._-]+/g, '-')
}
