import type { FC } from 'react';
import { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { ImageItem } from '@/lib/queue/types';
import { QueueResultsToolbar } from '@/components/results/QueueResultsToolbar';
import { VirtualizedQueueTableBody } from '@/components/results/VirtualizedQueueTableBody';

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

export const ResultsTable: FC<ResultsTableProps> = ({
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
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  const attachScrollEl = useCallback((node: HTMLDivElement | null) => {
    setScrollParent(node);
  }, []);

  if (itemIds.length === 0) return null;

  return (
    <Card className="glass rounded-3xl overflow-hidden border border-border/70 shadow-2xl shadow-primary/5 animate-slide-up delay-100">
      <QueueResultsToolbar
        savingsPercent={savingsPercent}
        hasFinishedItems={hasFinishedItems}
        doneCount={doneCount}
        totalCount={totalCount}
        onClearFinished={onClearFinished}
        onDownloadAll={onDownloadAll}
        onClear={onClear}
      />
      <CardContent className="p-0">
        <div ref={attachScrollEl} className="max-h-[600px] min-h-[100px] overflow-auto">
          <VirtualizedQueueTableBody
            itemIds={itemIds}
            onRemove={onRemoveItem}
            {...(onPreview ? { onPreview } : {})}
            scrollParent={scrollParent}
          />
        </div>
      </CardContent>
    </Card>
  );
};
