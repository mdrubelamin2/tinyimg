import type { ItemProps } from 'react-virtuoso';
import { useValue } from '@legendapp/state/react';
import { cn } from '@/lib/utils';
import { imageStore$ } from '@/store/image-store';
import { STATUS_PENDING } from '@/constants';

export function QueueTableVirtuosoRow(props: ItemProps<string>) {
  const { item: id, children, ...rest } = props;

  const status = useValue(() => imageStore$.items[id]?.status.get());

  const queued = status === STATUS_PENDING;

  return (
    <tr
      {...rest}
      data-testid={`queue-row-${id}`}
      className={cn(
        'border-b border-border/50 last:border-0 bg-surface/20 group hover:bg-muted/30 transition-opacity duration-200 [&>td]:align-middle',
        queued && 'opacity-60'
      )}
    >
      {children}
    </tr>
  );
}
