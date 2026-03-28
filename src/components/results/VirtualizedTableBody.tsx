import { useVirtualizer } from '@tanstack/react-virtual';
import { ResultRowCells } from './ResultRowCells';
import type { ImageItem } from '@/lib/queue/types';

const ROW_HEIGHT = 80;
const OVERSCAN = 5;

export interface VirtualizedTableBodyProps {
  itemIds: string[];
  onRemove: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  gridClass?: string;
}

export const VirtualizedTableBody = ({ 
  itemIds, 
  onRemove, 
  onPreview,
  scrollRef,
  gridClass,
}: VirtualizedTableBodyProps) => {
  const virtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  if (itemIds.length === 0) {
    return null;
  }

  return (
    <div className="relative" style={{ height: `${totalSize}px` }}>
      {virtualRows.map(virtualRow => {
        const id = itemIds[virtualRow.index];
        if (!id) return null;
        return (
          <div
            key={id}
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            role="row"
            className="absolute top-0 left-0 w-full border-b border-border/50 bg-surface/20 group hover:bg-muted/30 transition-colors duration-200"
            style={{
              height: `${ROW_HEIGHT}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <div className={`grid w-full h-full ${gridClass || ''}`} role="rowgroup">
              <ResultRowCells id={id} onRemove={onRemove} onPreview={onPreview} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
