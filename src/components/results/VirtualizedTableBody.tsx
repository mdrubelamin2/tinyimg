import { useVirtualizer } from '@tanstack/react-virtual';
import { ResultRowCells } from './ResultRowCells';
import type { ImageItem } from '@/lib/queue/types';

export interface VirtualizedTableBodyProps {
  itemIds: string[];
  onRemove: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

export const VirtualizedTableBody = ({ 
  itemIds, 
  onRemove, 
  onPreview,
  scrollRef,
}: VirtualizedTableBodyProps) => {
  const virtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  if (virtualRows.length === 0 && itemIds.length > 0) {
    return (
      <tr>
        <td colSpan={4} style={{ padding: '20px', textAlign: 'center' }}>
          Loading...
        </td>
      </tr>
    );
  }

  return (
    <>
      {virtualRows.map(virtualRow => {
        const id = itemIds[virtualRow.index];
        if (!id) return null;
        return (
          <tr
            key={id}
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ResultRowCells id={id} onRemove={onRemove} onPreview={onPreview} />
          </tr>
        );
      })}
    </>
  );
};
