import type { Observable } from '@legendapp/state'
import type { MouseEvent } from 'react'

import { For, Memo } from '@legendapp/state/react'
import { Download } from 'lucide-react'

import type { ImageResult } from '@/lib/queue/types'

import { Badge } from '@/components/ui/badge'
import { CrownIcon } from '@/components/ui/CrownIcon'
import { BYTES_PER_KB, STATUS_ERROR, STATUS_PROCESSING, STATUS_SUCCESS } from '@/constants'
import { downloadStoredOutput } from '@/lib/download'
import { buildOptimizedDownloadFilename } from '@/lib/result-download-name'
import { cn } from '@/lib/utils'
import { imageStore$ } from '@/store/image-store'

export function FormatChipsCellTable({ id }: { id: string }) {
  const node = imageStore$.items[id]

  if (!node) return null

  return (
    <div className='min-w-0 p-2 align-middle md:px-6 md:py-5'>
      <div className='flex w-full min-w-0 flex-wrap content-start gap-1'>
        <For
          each={node.results as Observable<Record<string, ImageResult>>}
          optimized
        >
          {(res$, key) => (
            <ResultChip
              fileName$={node.fileName}
              key={key}
              res$={res$}
              results$={node.results as Observable<Record<string, ImageResult>>}
            />
          )}
        </For>
      </div>
    </div>
  )
}

function ResultChip({
  fileName$,
  res$,
  results$,
}: {
  fileName$: Observable<string | undefined>
  res$: Observable<ImageResult>
  results$: Observable<Record<string, ImageResult>>
}) {
  const onDownloadClick = (e: MouseEvent) => {
    e.preventDefault()
    const res = res$.peek()
    const fileName = fileName$.peek() ?? ''
    if (res.status !== STATUS_SUCCESS || !res.payloadKey) return

    const dot = fileName.lastIndexOf('.')
    const base = dot > 0 ? fileName.slice(0, Math.max(0, dot)) : fileName
    const downloadFilename = buildOptimizedDownloadFilename(base, res as ImageResult)

    void downloadStoredOutput(res.payloadKey, res.format, downloadFilename)
  }

  return (
    <Memo>
      {() => {
        const res = res$.get()
        if (!res) return null

        const results = results$.get() ?? {}
        const successfulResults = Object.values(results).filter(
          (r) => r.status === STATUS_SUCCESS && r.size != null && r.size > 0,
        )

        const isChampion = (() => {
          if (successfulResults.length <= 1) return false
          let minSize = Infinity
          let champId = null
          for (const r of successfulResults) {
            if (r.size! < minSize) {
              minSize = r.size!
              champId = r.resultId
            }
          }
          return res.resultId === champId
        })()

        const chipClassName = cn(
          'flex shrink-0 items-center gap-1 p-2 rounded-xl border transition-all duration-200 min-w-0 relative',
          res.status === STATUS_SUCCESS
            ? isChampion
              ? 'bg-amber-500/5 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.1)] hover:border-amber-500/60 hover:bg-amber-500/10 cursor-pointer'
              : 'bg-surface border-border shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-md cursor-pointer'
            : 'bg-muted/50 border-border opacity-60 cursor-default',
        )

        const chipTitle =
          res.variantLabel && res.variantLabel.length > 0
            ? `${(res.format ?? '').toUpperCase()} · ${res.variantLabel}`
            : (res.label ?? res.format)

        if (res.status === STATUS_SUCCESS) {
          return (
            <button
              aria-label={`Download ${chipTitle}`}
              className={chipClassName}
              onClick={onDownloadClick}
              type='button'
            >
              {isChampion && (
                <div className='animate-bounce-subtle pointer-events-none absolute -top-3.5 -right-3.5 z-10 rotate-[45deg]'>
                  <CrownIcon />
                </div>
              )}
              <div className='flex flex-col text-left'>
                <span className='text-muted-foreground mb-1 text-[9px] leading-none font-black tracking-wider uppercase'>
                  {chipTitle}
                </span>
                <div className='flex items-center gap-1'>
                  <span className='text-foreground text-xs font-bold'>
                    {res.formattedSize ??
                      (res.size == null ? '—' : (res.size / BYTES_PER_KB).toFixed(1))}{' '}
                    KB
                  </span>
                  {res.savingsPercent != null && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-black',
                        isChampion
                          ? 'bg-amber-500/20 text-amber-500'
                          : 'text-success bg-success/15',
                      )}
                    >
                      -{res.savingsPercent}%
                    </span>
                  )}
                </div>
              </div>
              <Download
                className={cn(
                  'text-muted-foreground transition-colors',
                  isChampion ? 'group-hover:text-amber-500' : 'group-hover:text-primary',
                )}
                size={14}
              />
            </button>
          )
        }

        return (
          <div className={chipClassName}>
            <div className='flex flex-col'>
              <span className='text-muted-foreground mb-1 text-[9px] leading-none font-black tracking-wider uppercase'>
                {chipTitle}
              </span>
              {res.status === STATUS_ERROR ? (
                <Badge
                  className='rounded-full px-2 py-1 text-[9px] italic'
                  variant='error'
                >
                  Error
                </Badge>
              ) : res.status === STATUS_PROCESSING ? (
                <div className='bg-muted mt-1 h-1 w-12 overflow-hidden rounded-full'>
                  <div className='via-primary/60 animate-shimmer h-full w-full bg-gradient-to-r from-transparent to-transparent' />
                </div>
              ) : (
                <div className='bg-muted mt-1 h-1 w-12 overflow-hidden rounded-full'>
                  <div
                    className='bg-primary/50 h-full rounded-full'
                    style={{ width: '40%' }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      }}
    </Memo>
  )
}
