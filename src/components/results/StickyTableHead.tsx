import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export const StickyTableHead = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function StickyTableHead({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        {...props}
        className={cn(
          'sticky top-0 z-10 bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border backdrop-blur-sm grid',
          className
        )}
      />
    );
  }
);
