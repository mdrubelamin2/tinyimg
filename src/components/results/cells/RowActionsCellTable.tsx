import { Computed } from '@legendapp/state/react'
import { Eye, Trash2 } from 'lucide-react'

import type { ImageItem } from '@/lib/queue/types'

import { Button } from '@/components/ui/button'
import { getImageStore, imageStore$ } from '@/store/image-store'

export function RowActionsCellTable({
  id,
  onPreview,
}: {
  id: string
  onPreview: (item: ImageItem) => void
}) {
  const removeItem = getImageStore().removeItem
  const node = imageStore$.items[id]

  if (!node) return null

  const handlePreview = () => {
    const item = node.peek() as ImageItem | undefined
    if (item) onPreview?.(item)
  }

  return (
    <div className='px-2 py-4 align-middle md:px-6 md:py-5'>
      <div className='inline-flex w-full flex-wrap items-center justify-end gap-0.5 align-middle md:gap-1'>
        <Computed>
          {() => {
            const fileName = node.fileName.get()
            return (
              <Button
                aria-label={`Preview ${fileName}`}
                className='text-muted-foreground hover:bg-primary/10 hover:text-primary size-6 cursor-pointer transition-colors duration-200'
                onClick={handlePreview}
                size='icon'
                title='Preview'
                variant='ghost'
              >
                <Eye size={17} />
              </Button>
            )
          }}
        </Computed>
        <Computed>
          {() => {
            const fileName = node.fileName.get()
            return (
              <Button
                aria-label={`Remove ${fileName}`}
                className='text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-6 cursor-pointer transition-colors duration-200'
                onClick={() => removeItem(id)}
                size='icon'
                title='Remove item'
                variant='ghost'
              >
                <Trash2 size={17} />
              </Button>
            )
          }}
        </Computed>
      </div>
    </div>
  )
}
