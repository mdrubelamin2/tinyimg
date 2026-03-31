import React, { useRef, useDeferredValue } from 'react';
import { Download, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { VirtualizedTableBody } from './results/VirtualizedTableBody';
import type { ImageItem } from '@/lib/queue/types';

export interface ResultsTableProps {
  itemIds: string[];
  savingsPercent: string;
  hasFinishedItems: boolean;
  doneCount: number;
  totalCount: number;
  onClearFinished: () => void;
  onDownloadAll: () => void;
  onClear: () => void;
  onRemoveItem: (id: string) => void;
  onPreview?: ((item: ImageItem) => void) | undefined;
}

const TABLE_GRID_COLUMNS = 'grid-cols-[minmax(0,2fr)_150px_minmax(0,3fr)_100px]';

export const ResultsTable: React.FC<ResultsTableProps> = ({
  itemIds,
  savingsPercent,
  hasFinishedItems,
  doneCount,
  totalCount,
  onClearFinished,
  onDownloadAll,
  onClear,
  onRemoveItem,
  onPreview,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const deferredSavings = useDeferredValue(savingsPercent);
  const deferredDoneCount = useDeferredValue(doneCount);

  if (itemIds.length === 0) return null;

  const savingsValue = Number(deferredSavings);
  const isPositiveSavings = savingsValue > 0;

  return (
    <Card className="glass rounded-3xl overflow-hidden border border-border/70 shadow-2xl shadow-primary/5 animate-slide-up delay-100">
      <div className="px-6 md:px-8 py-5 md:py-6 bg-surface/50 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-bold text-foreground tracking-tight">Processing Queue</h3>
          <p className="text-sm text-muted-foreground">Wait for completion to batch download.</p>
        </div>
        <div className="flex items-center gap-2 md:gap-4 text-sm w-full sm:w-auto justify-center sm:justify-end">
          {deferredDoneCount > 0 && (
            <div className="text-center sm:text-right hidden sm:block mr-4">
              <p className="text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Optimized</p>
              <p className="font-black text-xl leading-none mt-1 text-foreground">
                {deferredDoneCount}/{totalCount}
              </p>
            </div>
          )}
          <div className="text-center sm:text-right hidden sm:block mr-4">
            <p className="text-muted-foreground uppercase font-bold text-[10px] tracking-widest">Total Savings</p>
            <p className={cn(
              'font-black text-xl leading-none mt-1',
              isPositiveSavings ? 'text-success' : 'text-warning'
            )}>
              {isPositiveSavings ? '-' : '+'}{Math.abs(savingsValue)}%
            </p>
          </div>
          {hasFinishedItems && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onClearFinished}
              className="font-bold text-[10px] uppercase tracking-widest cursor-pointer"
              title="Clear Optimized"
              aria-label="Clear completed items from queue"
            >
              <CheckCircle2 size={16} /> <span className="hidden xl:inline">Clear Optimized</span>
            </Button>
          )}
          <Button
            onClick={onDownloadAll}
            className="py-2 text-sm shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-colors cursor-pointer"
            aria-label="Download all as ZIP"
          >
            <Download size={18} /> <span className="hidden sm:inline">Download All (ZIP)</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors"
            title="Clear All"
            aria-label="Clear all items from queue"
          >
            <Trash2 size={20} />
          </Button>
        </div>
      </div>

      <CardContent className="p-0">
        <div ref={scrollRef} className="max-h-[600px] overflow-auto">
          <div className="w-full">
            <div className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border backdrop-blur-sm sticky top-0 z-[5]">
              <div className={`grid w-full ${TABLE_GRID_COLUMNS}`}>
                <div className="px-8 py-4">File Name</div>
                <div className="px-6 py-4 min-w-0">Original</div>
                <div className="px-6 py-4">Status &amp; Formats</div>
                <div className="px-6 py-4 min-w-0 text-right">Remove</div>
              </div>
            </div>
            <VirtualizedTableBody
              itemIds={itemIds}
              onRemove={onRemoveItem}
              onPreview={onPreview}
              scrollRef={scrollRef}
              gridClass={TABLE_GRID_COLUMNS}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
