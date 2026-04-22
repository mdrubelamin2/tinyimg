import { QueueResultsToolbar } from '@/components/results/QueueResultsToolbar';
import { VirtualizedQueueTableBody } from '@/components/results/VirtualizedQueueTableBody';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';

export const ResultsTable = () => {
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);

  return (
    <Card className="glass rounded-3xl overflow-hidden border border-border/70 shadow-2xl shadow-primary/5 animate-slide-up delay-100">
      <QueueResultsToolbar />
      <CardContent className="p-0">
        <div ref={setScrollParent} className="max-h-[600px] min-h-[100px] overflow-auto">
          <VirtualizedQueueTableBody
            scrollParent={scrollParent as HTMLDivElement}
          />
        </div>
      </CardContent>
    </Card>
  );
};
