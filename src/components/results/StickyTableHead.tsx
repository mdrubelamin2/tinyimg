import { type ComponentPropsWithoutRef, forwardRef } from 'react'

import { cn } from '@/lib/utils'

export const StickyTableHead = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function StickyTableHead({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        {...props}
        className={cn(
          'bg-muted/50 text-muted-foreground border-border sticky top-0 z-10 grid border-b text-[10px] font-bold tracking-widest uppercase backdrop-blur-sm',
          className,
        )}
      />
    )
  },
)
