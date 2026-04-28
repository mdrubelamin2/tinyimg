import { useRef } from 'react'

import { QueueResultsToolbar } from '@/components/results/QueueResultsToolbar'
import { VirtualizedQueueTableBody } from '@/components/results/VirtualizedQueueTableBody'
import { Card, CardContent } from '@/components/ui/card'

export const ResultsTable = () => {
  const scrollParent = useRef<HTMLDivElement | null>(null)

  return (
    <Card className='glass border-border/70 shadow-primary/5 animate-slide-up overflow-hidden rounded-3xl border shadow-2xl delay-100'>
      <QueueResultsToolbar />
      <CardContent className='p-0'>
        <div
          className='max-h-150 min-h-35 overflow-y-auto contain-content'
          ref={scrollParent}
        >
          <VirtualizedQueueTableBody scrollParent={scrollParent} />
        </div>
      </CardContent>
    </Card>
  )
}
