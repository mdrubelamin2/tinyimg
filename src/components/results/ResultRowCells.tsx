import type { ImageItem } from '@/lib/queue/types';
import { FilenameCellTable } from './cells/FilenameCellTable';
import { OriginalSizeCellTable } from './cells/OriginalSizeCellTable';
import { FormatChipsCellTable } from './cells/FormatChipsCellTable';
import { RowActionsCellTable } from './cells/RowActionsCellTable';
import { preview$ } from '@/store/preview-store';

export interface ResultRowCellsProps {
  id: string;
}

export function ResultRowCells({ id }: ResultRowCellsProps) {
  const handlePreview = (item: ImageItem) => {
    const resultIds = Object.keys(item.results);
    const firstResultId = resultIds[0];
    if (!firstResultId) return;
    preview$.set({
      itemId: item.id,
      selectedResultId: firstResultId,
    });
  };

  return (
    <>
      <FilenameCellTable id={id} onPreview={handlePreview} />
      <OriginalSizeCellTable id={id} />
      <FormatChipsCellTable id={id} />
      <RowActionsCellTable id={id} onPreview={handlePreview} />
    </>
  );
}
