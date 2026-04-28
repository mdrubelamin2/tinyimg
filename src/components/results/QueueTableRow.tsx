import { useValue } from '@legendapp/state/react'
import { type HTMLAttributes } from 'react'

import { STATUS_PENDING } from '@/constants'
import { cn } from '@/lib/utils'
import { imageStore$ } from '@/store/image-store'

export interface QueueTableRowProps extends HTMLAttributes<HTMLDivElement> {
  id: string
  index: number
  ref: (node: Element | null) => void
}

export const QueueTableRow = ({
  children,
  className,
  id,
  index,
  ref,
  ...rest
}: QueueTableRowProps) => {
  const status = useValue(() => imageStore$.items[id]?.status.get())
  const queued = status === STATUS_PENDING

  return (
    <div
      {...rest}
      className={cn(
        'grid grid-cols-[25%_15%_40%_20%]',
        'border-border/50 bg-surface/20 group hover:bg-muted/30 items-center border-b transition-opacity duration-200 last:border-0',
        queued && 'opacity-60',
        className,
      )}
      data-index={index}
      data-testid={`queue-row-${id}`}
      ref={ref}
    >
      {children}
    </div>
  )
}
