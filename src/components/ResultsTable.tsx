import { QueueResultsToolbar } from '@/components/results/QueueResultsToolbar'
import { VirtualizedQueueTableBody } from '@/components/results/VirtualizedQueueTableBody'
import { Card, CardContent } from '@/components/ui/card'

const ResultsTable = () => {
  return (
    <Card className='glass border-border/70 shadow-primary/5 animate-slide-up overflow-hidden rounded-3xl border shadow-2xl delay-100'>
      <QueueResultsToolbar />
      <CardContent className='p-0'>
        <VirtualizedQueueTableBody />
      </CardContent>
    </Card>
  )
}

export default ResultsTable
