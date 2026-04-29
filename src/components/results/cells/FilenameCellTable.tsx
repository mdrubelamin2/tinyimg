import { Computed, Memo } from '@legendapp/state/react'
import { Eye } from 'lucide-react'

import type { ImageItem } from '@/lib/queue/types'

import { imageStore$ } from '@/store/image-store'
import { thumbnailCachePeek } from '@/thumbnails/thumbnail-cache'

export function FilenameCellTable({
  id,
  onPreview,
}: {
  id: string
  onPreview?: (item: ImageItem) => void
}) {
  const node = imageStore$.items[id]

  if (!node) return null

  const handlePreview = () => {
    const item = node.peek() as ImageItem | undefined
    if (item) onPreview?.(item)
  }

  return (
    <div
      className='min-w-0 p-2 align-middle md:px-6 md:py-5 lg:px-8'
      data-testid='filename-cell'
    >
      <div className='flex min-w-0 items-center gap-3'>
        <button
          aria-label={`Open preview for ${node.fileName.peek()}`}
          className='bg-muted group-hover:bg-primary/10 relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl shadow-sm transition-colors duration-200'
          onClick={handlePreview}
          type='button'
        >
          <Memo>
            {() => {
              const previewUrl = node.previewUrl.get()
              const thumbUrl = thumbnailCachePeek(id) ?? previewUrl

              return thumbUrl ? (
                <img
                  alt=''
                  className='h-full w-full object-cover'
                  decoding='async'
                  fetchPriority='low'
                  src={thumbUrl}
                />
              ) : (
                <div
                  aria-hidden
                  className='bg-muted/70 absolute inset-0 overflow-hidden rounded-[inherit]'
                >
                  <div className='via-foreground/[0.06] animate-thumbnail-shimmer h-full w-full bg-gradient-to-r from-transparent to-transparent' />
                </div>
              )
            }}
          </Memo>
          <div className='absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
            <Eye
              className='text-white'
              size={16}
            />
          </div>
        </button>
        <div className='min-w-0'>
          <p
            className='text-foreground w-full max-w-full min-w-0 truncate text-sm font-semibold md:max-w-[28rem]'
            data-testid='filename'
          >
            <Computed>{() => node.fileName.get()}</Computed>
          </p>
          <p className='text-muted-foreground font-mono text-[10px] tracking-tighter uppercase'>
            <Computed>{() => node.originalFormat.get()}</Computed>
          </p>
        </div>
      </div>
    </div>
  )
}
