import type { ImageItem } from '@/lib/queue/types';
import { FilenameCellTable } from './cells/FilenameCellTable';
import { OriginalSizeCellTable } from './cells/OriginalSizeCellTable';
import { FormatChipsCellTable } from './cells/FormatChipsCellTable';
import { RowActionsCellTable } from './cells/RowActionsCellTable';

export interface ResultRowCellsProps {
  id: string;
  onRemove: (id: string) => void;
  onPreview?: (item: ImageItem) => void;
}

/** `<td>` cells for one queue row (TableVirtuoso). */
export function ResultRowCells({ id, onRemove, onPreview }: ResultRowCellsProps) {
  return (
    <>
      <FilenameCellTable id={id} {...(onPreview ? { onPreview } : {})} />
      <OriginalSizeCellTable id={id} />
      <FormatChipsCellTable id={id} />
      <RowActionsCellTable id={id} onRemove={onRemove} {...(onPreview ? { onPreview } : {})} />
    </>
  );
}
