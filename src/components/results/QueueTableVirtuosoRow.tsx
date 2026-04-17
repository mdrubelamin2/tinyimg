import type { ItemProps } from 'react-virtuoso';
import { useValue } from '@legendapp/state/react';
import { cn } from '@/lib/utils';
import { imageStore$ } from '@/store/image-store';
import { STATUS_PENDING, STATUS_PROCESSING } from '@/constants';
import { queueRowAriaLabel } from './row-aria-label';

export function QueueTableVirtuosoRow(props: ItemProps<string>) {
  const { item: id, children, ...rest } = props;
  const meta = useValue(() => {
    const node = imageStore$.items[id];
    if (!node) return undefined;
    return {
      status: node.status.get(),
      fileName: node.fileName.get(),
    };
  });
  if (!meta) return null;
  const { status, fileName } = meta;
  if (fileName === undefined || status === undefined) return null;

  const queued = status === STATUS_PENDING;

  return (
    <tr
      {...rest}
      data-testid={`queue-row-${id}`}
      className={cn(
        'border-b border-border/50 last:border-0 bg-surface/20 group hover:bg-muted/30 transition-opacity transition-colors duration-200 [&>td]:align-middle',
        queued && 'opacity-60'
      )}
      aria-busy={status === STATUS_PROCESSING}
      aria-label={queueRowAriaLabel({ status, fileName })}
    >
      {children}
    </tr>
  );
}
