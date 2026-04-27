import { QueueResultsToolbar } from '@/components/results/QueueResultsToolbar';
import { VirtualizedQueueTableBody } from '@/components/results/VirtualizedQueueTableBody';
import { Card, CardContent } from '@/components/ui/card';
import { useRef } from 'react';

export const ResultsTable = () => {
  const scrollParent = useRef<HTMLDivElement | null>(null);

  return (
    <Card className="glass rounded-3xl overflow-hidden border border-border/70 shadow-2xl shadow-primary/5 animate-slide-up delay-100">
      <QueueResultsToolbar />
      <CardContent className="p-0">
        <div ref={scrollParent} className="max-h-150 min-h-35 overflow-auto">
          <VirtualizedQueueTableBody
            scrollParent={scrollParent}
          />
        </div>
      </CardContent>
    </Card>
  );
};
