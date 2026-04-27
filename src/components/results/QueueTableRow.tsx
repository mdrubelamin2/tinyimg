import { STATUS_PENDING } from '@/constants';
import { cn } from '@/lib/utils';
import { imageStore$ } from '@/store/image-store';
import { useValue } from '@legendapp/state/react';
import { type HTMLAttributes } from 'react';

export interface QueueTableRowProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  index: number;
  start: number;
}

export const QueueTableRow = ({ id, index, start, children, className, ...rest }: QueueTableRowProps) => {
  const status = useValue(() => imageStore$.items[id]?.status.get());
  const queued = status === STATUS_PENDING;

  return (
    <div
      {...rest}
      data-index={index}
      data-testid={`queue-row-${id}`}
      style={{
        transform: `translate3d(0, ${start}px, 0)`,
      }}
      className={cn(
        'absolute top-0 left-0 w-full grid grid-cols-[25%_15%_40%_20%] will-change-transform contain-[layout_style_paint]',
        'border-b border-border/50 last:border-0 bg-surface/20 group hover:bg-muted/30 transition-opacity duration-200 items-center',
        queued && 'opacity-60',
        className
      )}
    >
      {children}
    </div>
  );
}
