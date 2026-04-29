import { Show, useValue } from '@legendapp/state/react'
import { CheckCircle2, Download, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { queueStats$ } from '@/state/queue-stats'
import { getImageStore } from '@/store/image-store'

export function QueueResultsToolbar() {
  const clearFinished = getImageStore().clearFinished
  const downloadAll = getImageStore().downloadAll
  const clearAll = getImageStore().clearAll
  const savingsPercent = useValue(() => queueStats$.savingsPercent.get())
  const savingsValue = Number(savingsPercent)
  const isPositiveSavings = savingsValue > 0
  const totalOutputCount = useValue(() => queueStats$.totalOutputCount.get())
  const successfulOutputCount = useValue(() => queueStats$.successfulOutputCount.get())

  return (
    <div className='bg-surface/50 border-border border-b px-4 py-4 md:px-8 md:py-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6'>
        <div className='min-w-0 text-center md:text-left'>
          <h3 className='text-foreground text-lg font-bold tracking-tight'>Processing Queue</h3>
          <p className='text-muted-foreground text-sm text-balance'>
            Wait for completion to batch download.
          </p>
        </div>

        <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end'>
          <div className='flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-end'>
            <Show ifReady={successfulOutputCount}>
              <div className='text-center sm:text-right'>
                <p className='text-muted-foreground text-[10px] font-bold tracking-widest uppercase'>
                  Optimized
                </p>
                <p className='text-foreground mt-1 text-lg leading-none font-black tabular-nums sm:text-xl'>
                  {successfulOutputCount}/{totalOutputCount}
                </p>
              </div>
            </Show>
            <div className='text-center sm:text-right'>
              <p className='text-muted-foreground text-[10px] font-bold tracking-widest uppercase'>
                Total Savings
              </p>
              <p
                className={cn(
                  'mt-1 text-lg leading-none font-black tabular-nums sm:text-xl',
                  isPositiveSavings ? 'text-success' : 'text-warning',
                )}
              >
                {isPositiveSavings ? '-' : '+'}
                {Math.abs(savingsValue)}%
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center justify-center gap-2 sm:justify-end'>
            <Show ifReady={successfulOutputCount}>
              <Button
                aria-label='Clear completed items from queue'
                className='cursor-pointer text-[10px] font-bold tracking-widest uppercase'
                onClick={clearFinished}
                size='sm'
                title='Clear Optimized'
                variant='secondary'
              >
                <CheckCircle2
                  className='shrink-0'
                  size={16}
                />
                <span className='hidden xl:inline'>Clear Optimized</span>
              </Button>
            </Show>
            <Button
              aria-label='Download all as ZIP'
              className='shadow-primary/25 hover:shadow-primary/40 cursor-pointer py-2 text-sm shadow-lg transition-colors'
              onClick={downloadAll}
            >
              <Download
                className='shrink-0'
                size={18}
              />
              <span className='sm:hidden'>ZIP</span>
              <span className='hidden sm:inline'>Download All (ZIP)</span>
            </Button>
            <Button
              aria-label='Clear all items from queue'
              className='text-destructive hover:bg-destructive/10 hover:text-destructive min-h-11 min-w-11 cursor-pointer transition-colors md:min-h-10 md:min-w-10'
              onClick={clearAll}
              size='icon'
              title='Clear All'
              variant='ghost'
            >
              <Trash2 size={20} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
