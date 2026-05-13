import type { ImageItem } from '@/lib/queue/types'

import {
  type GlobalOptions,
  isValidImageExtension,
  type OutputFormat,
  SUPPORTED_FORMATS,
} from '@/constants'

export function getFormatsToProcess(item: ImageItem, options: GlobalOptions): OutputFormat[] {
  if (options.useOriginalFormats) {
    const normalizedOriginal = normalizeFormat(item.originalFormat) as OutputFormat
    if (isValidImageExtension(normalizedOriginal)) {
      return [normalizedOriginal]
    }
    const fb = [...new Set(options.formats)] as OutputFormat[]
    return fb.length > 0 ? fb : ([...SUPPORTED_FORMATS] as OutputFormat[])
  }

  const normalizedOriginal = normalizeFormat(item.originalFormat) as OutputFormat
  const withOriginal = options.includeOriginalInCustom
    ? [normalizedOriginal, ...options.formats]
    : options.formats

  return [...new Set(withOriginal)] as OutputFormat[]
}

function normalizeFormat(format: string): string {
  return format === 'jpg' ? 'jpeg' : format
}
