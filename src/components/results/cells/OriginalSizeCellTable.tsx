import { Computed } from '@legendapp/state/react';
import { imageStore$ } from '@/store/image-store';
import { BYTES_PER_KB } from '@/constants';

export function OriginalSizeCellTable({ id }: { id: string }) {
  const node = imageStore$.items[id];

  if (!node) return null;

  return (
    <div className="p-2 align-middle text-xs font-medium text-muted-foreground min-w-0 tabular-nums md:px-6 md:py-5">
      <Computed>
        {() => {
          const formattedOriginalSize = node.formattedOriginalSize.get();
          const originalSize = node.originalSize.get();
          if (originalSize === undefined) return null;
          return formattedOriginalSize ?? `${(originalSize / BYTES_PER_KB).toFixed(1)} KB`;
        }}
      </Computed>
    </div>
  );
}
