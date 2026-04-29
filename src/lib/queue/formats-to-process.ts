import type { ImageItem } from '@/lib/queue/types'

import { type GlobalOptions, isValidImageExtension, SUPPORTED_FORMATS } from '@/constants'

export function getFormatsToProcess(item: ImageItem, options: GlobalOptions): string[] {
  if (options.useOriginalFormats) {
    const normalizedOriginal = normalizeFormat(item.originalFormat)
    if (isValidImageExtension(normalizedOriginal)) {
      return [normalizedOriginal]
    }
    const fb = [...new Set(options.formats)]
    return fb.length > 0 ? fb : [...SUPPORTED_FORMATS]
  }

  const normalizedOriginal = normalizeFormat(item.originalFormat)
  const withOriginal = options.includeOriginalInCustom
    ? [normalizedOriginal, ...options.formats]
    : options.formats

  return [...new Set(withOriginal)]
}

function normalizeFormat(format: string): string {
  return format === 'jpg' ? 'jpeg' : format
}
