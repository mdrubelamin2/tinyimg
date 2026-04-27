'use no memo';

import { useValue } from '@legendapp/state/react';
import { cn } from '@/lib/utils';
import { imageStore$ } from '@/store/image-store';
import { STATUS_PENDING } from '@/constants';
import { forwardRef, type HTMLAttributes } from 'react';

export interface QueueTableRowProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  index: number;
  measureElement: (el: HTMLElement | null) => void;
  start: number;
}

export const QueueTableRow = forwardRef<HTMLDivElement, QueueTableRowProps>(
  ({ id, index, measureElement, start, children, className, ...rest }, ref) => {
    const status = useValue(() => imageStore$.items[id]?.status.get());
    const queued = status === STATUS_PENDING;

    return (
      <div
        {...rest}
        ref={(el) => {
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
          measureElement(el);
        }}
        data-index={index}
        data-testid={`queue-row-${id}`}
        style={{
          transform: `translate3d(0, ${start}px, 0)`,
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '28% 12% 45% 15%',
          contain: 'layout style paint',
          willChange: 'transform',
        }}
        className={cn(
          'border-b border-border/50 last:border-0 bg-surface/20 group hover:bg-muted/30 transition-opacity duration-200 items-center',
          queued && 'opacity-60',
          className
        )}
      >
        {children}
      </div>
    );
  }
);
