import { Upload } from 'lucide-react'

import { useFileDropOverlayOpen } from '@/hooks/use-file-drop-overlay-open'
import { cn } from '@/lib/utils'

/** Full-viewport hint while dragging files over the document (pointer-events none so drops reach targets). */
export function FileDropOverlay() {
  const fileDropOverlayOpen = useFileDropOverlayOpen()
  if (!fileDropOverlayOpen) return null

  return (
    <div
      aria-hidden
      className={cn(
        'fixed inset-0 z-100 flex flex-col items-center justify-center',
        'bg-background/70 pointer-events-none backdrop-blur-sm',
        'border-primary/50 ring-primary/10 border-[3px] border-dashed ring-1 ring-inset',
        'animate-fade-in',
      )}
    >
      <div
        className={cn(
          'mx-6 rounded-3xl px-8 py-10',
          'flex max-w-md flex-col items-center gap-4 text-center',
        )}
      >
        <div className='bg-primary/10 text-primary rounded-2xl p-5'>
          <Upload
            aria-hidden
            className='h-12 w-12'
            strokeWidth={1.35}
          />
        </div>
        <p className='text-foreground text-xl font-bold tracking-tight'>Drop to add to the queue</p>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          Folders and ZIPs supported · Images max 25MB, ZIP max 2GB · Stays on your device
        </p>
      </div>
    </div>
  )
}
