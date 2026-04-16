import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropOverlayProps {
  open: boolean;
}

/** Full-viewport hint while dragging files over the document (pointer-events none so drops reach targets). */
export function FileDropOverlay({ open }: FileDropOverlayProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex flex-col items-center justify-center',
        'pointer-events-none bg-background/70 backdrop-blur-sm',
        'border-[3px] border-dashed border-primary/50 ring-1 ring-inset ring-primary/10',
        'animate-fade-in'
      )}
      aria-hidden
    >
      <div
        className={cn(
          'mx-6 rounded-3xl border border-primary/15 bg-card/95 px-8 py-10 shadow-2xl',
          'flex max-w-md flex-col items-center gap-4 text-center'
        )}
      >
        <div className="rounded-2xl bg-primary/10 p-5 text-primary">
          <Upload className="h-12 w-12" strokeWidth={1.35} aria-hidden />
        </div>
        <p className="text-xl font-bold tracking-tight text-foreground">Drop to add to the queue</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Folders and ZIPs supported · Images max 25MB, ZIP max 2GB · Stays on your device
        </p>
      </div>
    </div>
  );
}
