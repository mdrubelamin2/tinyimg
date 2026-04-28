import { useValue } from '@legendapp/state/react'
import { Download, X, ZoomIn } from 'lucide-react'
import { useEffect, useRef, useState, ViewTransition } from 'react'

import type { ImageItem, ImageResult } from '@/lib/queue/types'

import { ImageCompareViewer } from '@/components/preview/ImageCompareViewer'
import { BYTES_PER_KB, mimeForOutputFormat, STATUS_SUCCESS } from '@/constants'
import { downloadStoredOutput } from '@/lib/download'
import { buildOptimizedDownloadFilename } from '@/lib/result-download-name'
import { cn } from '@/lib/utils'
import { isHeicDecodeLikelySupported } from '@/lib/validation'
import {
  createTransientObjectUrlForPayloadKey,
  resolveOriginalSourceFile,
} from '@/storage/queue-binary'
import { imageStore$ } from '@/store/image-store'

interface ImagePreviewProps {
  itemId: string
  onClose: () => void
  onResultChange: (resultId: string) => void
  selectedResultId: string
}

function chipTitleForResult(result: ImageResult): string {
  if (result.variantLabel != null && result.variantLabel.length > 0) {
    return `${result.format.toUpperCase()} · ${result.variantLabel}`
  }
  return result.label ?? result.format
}

const ImagePreview = ({ itemId, onClose, onResultChange, selectedResultId }: ImagePreviewProps) => {
  const item = useValue(() => imageStore$.items[itemId]?.get())

  const [resolvedOriginalObjectUrl, setResolvedOriginalObjectUrl] = useState<null | string>(null)
  const resolvedOriginalRef = useRef<null | string>(null)

  const [optimizedObjectUrl, setOptimizedObjectUrl] = useState<null | string>(null)
  const optimizedRef = useRef<null | string>(null)

  const successResults = item
    ? Object.values(item.results)
        .filter((r) => r.status === STATUS_SUCCESS)
        .sort((a, b) => a.resultId.localeCompare(b.resultId))
    : []

  const currentResult = item?.results[selectedResultId]
  const originalUrl = resolvedOriginalObjectUrl
  const optimizedUrl = optimizedObjectUrl
  const originalSize = item?.originalSize ?? 0
  const optimizedSize = currentResult?.size ?? 0

  const isPreviewSupported = (format: string | undefined) => {
    if (isHeicDecodeLikelySupported()) {
      return true
    }
    return !(format === 'heic' || format === 'heif')
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const snap = imageStore$.items[itemId]?.peek() as ImageItem | undefined
      if (!snap) return
      if (!isPreviewSupported(snap.originalFormat)) {
        return
      }
      const file = await resolveOriginalSourceFile(snap.id, snap)
      if (cancelled || !file) return
      const url = URL.createObjectURL(file)
      if (cancelled) {
        URL.revokeObjectURL(url)
        return
      }
      if (resolvedOriginalRef.current) {
        URL.revokeObjectURL(resolvedOriginalRef.current)
      }
      resolvedOriginalRef.current = url
      setResolvedOriginalObjectUrl(url)
    })()

    return () => {
      cancelled = true
      if (resolvedOriginalRef.current) {
        URL.revokeObjectURL(resolvedOriginalRef.current)
        resolvedOriginalRef.current = null
      }
      setResolvedOriginalObjectUrl(null)
    }
  }, [itemId])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const snap = imageStore$.items[itemId]?.peek() as ImageItem | undefined
      const r = snap?.results[selectedResultId]
      if (!isPreviewSupported(r?.format)) {
        return
      }
      if (!r || r.status !== STATUS_SUCCESS || !r.payloadKey) {
        if (optimizedRef.current) {
          URL.revokeObjectURL(optimizedRef.current)
          optimizedRef.current = null
        }
        setOptimizedObjectUrl(null)
        return
      }
      const mime = mimeForOutputFormat(r.format)
      const url = await createTransientObjectUrlForPayloadKey(r.payloadKey, mime)
      if (cancelled) {
        URL.revokeObjectURL(url)
        return
      }
      if (optimizedRef.current) {
        URL.revokeObjectURL(optimizedRef.current)
      }
      optimizedRef.current = url
      setOptimizedObjectUrl(url)
    })()

    return () => {
      cancelled = true
      if (optimizedRef.current) {
        URL.revokeObjectURL(optimizedRef.current)
        optimizedRef.current = null
      }
      setOptimizedObjectUrl(null)
    }
  }, [itemId, selectedResultId, currentResult?.payloadKey, currentResult?.status])

  const savings =
    originalSize > 0 && optimizedSize > 0
      ? (((originalSize - optimizedSize) / originalSize) * 100).toFixed(1)
      : '0'

  const lastDotIndex = item?.fileName.lastIndexOf('.') ?? -1
  const downloadBaseName =
    lastDotIndex > 0 ? item!.fileName.slice(0, Math.max(0, lastDotIndex)) : (item?.fileName ?? '')

  const formatBytes = (bytes: number) => {
    if (bytes < BYTES_PER_KB) return `${bytes} B`
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`
  }

  if (!item) return null

  return (
    <ViewTransition>
      <div
        aria-label={`Preview comparison for ${item.fileName}`}
        className='fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm'
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClose()
          }
        }}
        role='button'
        tabIndex={0}
      >
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className='border-border bg-surface text-surface-foreground relative flex max-h-[85vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl'
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className='border-border flex items-center justify-between gap-3 border-b px-6 py-4'>
            <div className='flex min-w-0 flex-1 items-center gap-3'>
              <ZoomIn
                className='text-primary shrink-0'
                size={18}
              />
              <div className='min-w-0 flex-1'>
                <h3 className='text-foreground max-w-full min-w-0 truncate text-sm font-bold'>
                  {item.fileName}
                </h3>
                <p className='text-muted-foreground text-[10px] font-bold tracking-wider uppercase'>
                  {currentResult ? chipTitleForResult(currentResult) : '…'} · Saved {savings}%
                </p>
              </div>
            </div>
            <button
              aria-label='Close preview'
              className='hover:bg-muted shrink-0 rounded-full p-2 transition-colors'
              onClick={onClose}
            >
              <X
                className='text-muted-foreground'
                size={20}
              />
            </button>
          </div>

          {/* Format Tabs */}
          {successResults.length > 1 && (
            <div className='border-border/50 from-muted/20 via-muted/30 to-muted/20 scrollbar-hide flex items-center gap-1.5 overflow-x-auto border-b bg-gradient-to-r px-4 py-2'>
              {successResults.map((result) => {
                const isActive = result.resultId === selectedResultId
                const formatSavings =
                  originalSize > 0 && result.size && result.size > 0
                    ? (((originalSize - result.size) / originalSize) * 100).toFixed(0)
                    : null

                return (
                  <button
                    className={cn(
                      'group relative flex-shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-[11px] font-bold tracking-wide transition-all duration-200 ease-out',
                      isActive
                        ? 'from-primary to-primary/80 text-primary-foreground shadow-primary/20 bg-gradient-to-br shadow-md'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none',
                    )}
                    key={result.resultId}
                    onClick={() => onResultChange(result.resultId)}
                  >
                    <span className='flex items-center gap-1.5 whitespace-nowrap'>
                      <span
                        className={cn(
                          'h-1 w-1 rounded-full',
                          isActive
                            ? 'bg-white/80'
                            : 'bg-muted-foreground/50 group-hover:bg-success',
                        )}
                      />
                      <span className='uppercase'>{chipTitleForResult(result)}</span>
                      {formatSavings && (
                        <span
                          className={cn(
                            'ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black',
                            isActive
                              ? 'bg-white/20 text-white/90'
                              : 'bg-success/20 text-success group-hover:bg-success/30',
                          )}
                        >
                          ↓{formatSavings}%
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className='bg-muted relative aspect-video min-h-0 w-full shrink-0 touch-none overflow-hidden select-none'>
            <div className='absolute inset-0 min-h-0 overflow-hidden'>
              {!originalUrl && !optimizedUrl && (
                <div className='flex h-full flex-col items-center justify-center gap-2'>
                  <p className='text-muted-foreground text-sm'>Image Preview not available</p>
                </div>
              )}
              {originalUrl && !optimizedUrl && (
                <img
                  alt={`Original ${item.fileName}`}
                  className='h-full w-full object-contain'
                  src={originalUrl}
                />
              )}
              {!originalUrl && optimizedUrl && (
                <img
                  alt={`Optimized ${item.fileName}`}
                  className='h-full w-full object-contain'
                  src={optimizedUrl}
                />
              )}
              {originalUrl && optimizedUrl && (
                <ImageCompareViewer
                  className='!rounded-none border-0 bg-transparent'
                  initialPositionPercent={90}
                  optimizedUrl={optimizedUrl}
                  originalUrl={originalUrl}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className='border-border bg-muted/20 flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
            <span className='text-muted-foreground text-center text-[10px] font-medium sm:text-left'>
              Drag to compare. ESC to close
            </span>
            {currentResult?.payloadKey && (
              <button
                aria-label={`Download ${chipTitleForResult(currentResult)}`}
                className='from-primary to-primary/80 text-primary-foreground shadow-primary/25 flex cursor-pointer items-center justify-center gap-1.5 self-center rounded-lg bg-gradient-to-r px-3 py-2 text-[10px] font-bold shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg sm:self-auto sm:py-1.5'
                onClick={() => {
                  if (!currentResult.payloadKey) return
                  void downloadStoredOutput(
                    currentResult.payloadKey,
                    currentResult.format,
                    buildOptimizedDownloadFilename(downloadBaseName, currentResult),
                  )
                }}
                type='button'
              >
                <Download size={12} />
                <span className='uppercase'>{chipTitleForResult(currentResult)}</span>
                <span className='opacity-70'>·</span>
                <span>{formatBytes(optimizedSize)}</span>
                {savings !== '0' && (
                  <span className='rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]'>
                    ↓{savings}%
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </ViewTransition>
  )
}

export default ImagePreview
