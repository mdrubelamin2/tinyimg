import { memo } from 'react'

import type { ImageItem } from '@/lib/queue/types'

import { preview$ } from '@/store/preview-store'

import { FilenameCellTable } from './cells/FilenameCellTable'
import { FormatChipsCellTable } from './cells/FormatChipsCellTable'
import { OriginalSizeCellTable } from './cells/OriginalSizeCellTable'
import { RowActionsCellTable } from './cells/RowActionsCellTable'

interface ResultRowCellsProps {
  id: string
}

const ResultRowCells = memo(({ id }: ResultRowCellsProps) => {
  const handlePreview = (item: ImageItem) => {
    const resultIds = Object.keys(item.results)
    const firstResultId = resultIds[0]
    if (!firstResultId) return
    preview$.set({
      itemId: item.id,
      selectedResultId: firstResultId,
    })
  }

  return (
    <>
      <FilenameCellTable
        id={id}
        onPreview={handlePreview}
      />
      <OriginalSizeCellTable id={id} />
      <FormatChipsCellTable id={id} />
      <RowActionsCellTable
        id={id}
        onPreview={handlePreview}
      />
    </>
  )
})

ResultRowCells.displayName = 'ResultRowCells'

export default ResultRowCells
