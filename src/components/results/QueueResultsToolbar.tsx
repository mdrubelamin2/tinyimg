import { useDeferredValue } from 'react';
import { CheckCircle2, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface QueueResultsToolbarProps {
  savingsPercent: string;
  hasFinishedItems: boolean;
  doneCount: number;
  totalCount: number;
  onClearFinished: () => void;
  onDownloadAll: () => void;
  onClear: () => void;
}

export function QueueResultsToolbar({
  savingsPercent,
  hasFinishedItems,
  doneCount,
  totalCount,
  onClearFinished,
  onDownloadAll,
  onClear,
}: QueueResultsToolbarProps) {
  const deferredSavings = useDeferredValue(savingsPercent);
  const deferredDoneCount = useDeferredValue(doneCount);
  const savingsValue = Number(deferredSavings);
  const isPositiveSavings = savingsValue > 0;

  return (
    <div className="px-4 py-4 bg-surface/50 border-b border-border md:px-8 md:py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="text-center md:text-left min-w-0">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Processing Queue</h3>
          <p className="text-sm text-muted-foreground text-balance">
            Wait for completion to batch download.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-end">
            {deferredDoneCount > 0 && (
              <div className="text-center sm:text-right">
                <p className="text-muted-foreground uppercase font-bold text-[10px] tracking-widest">
                  Optimized
                </p>
                <p className="font-black text-lg sm:text-xl leading-none mt-1 text-foreground tabular-nums">
                  {deferredDoneCount}/{totalCount}
                </p>
              </div>
            )}
            <div className="text-center sm:text-right">
              <p className="text-muted-foreground uppercase font-bold text-[10px] tracking-widest">
                Total Savings
              </p>
              <p
                className={cn(
                  'font-black text-lg sm:text-xl leading-none mt-1 tabular-nums',
                  isPositiveSavings ? 'text-success' : 'text-warning'
                )}
              >
                {isPositiveSavings ? '-' : '+'}
                {Math.abs(savingsValue)}%
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap sm:justify-end">
            {hasFinishedItems && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onClearFinished}
                className="font-bold text-[10px] uppercase tracking-widest cursor-pointer"
                title="Clear Optimized"
                aria-label="Clear completed items from queue"
              >
                <CheckCircle2 size={16} className="shrink-0" />
                <span className="hidden xl:inline">Clear Optimized</span>
              </Button>
            )}
            <Button
              onClick={onDownloadAll}
              className="py-2 text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-colors cursor-pointer"
              aria-label="Download all as ZIP"
            >
              <Download size={18} className="shrink-0" />
              <span className="sm:hidden">ZIP</span>
              <span className="hidden sm:inline">Download All (ZIP)</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors min-h-11 min-w-11 md:min-h-10 md:min-w-10"
              title="Clear All"
              aria-label="Clear all items from queue"
            >
              <Trash2 size={20} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
