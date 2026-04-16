import { useValue } from '@legendapp/state/react';
import { imageStore$ } from '@/store/image-store';
import { BYTES_PER_KB } from '@/constants';

export function OriginalSizeCellTable({ id }: { id: string }) {
  const snap = useValue(() => {
    const node = imageStore$.items[id];
    if (!node) return undefined;
    return {
      formattedOriginalSize: node.formattedOriginalSize.get(),
      originalSize: node.originalSize.get(),
    };
  });

  if (!snap) return null;

  return (
    <td className="px-6 py-5 align-middle text-xs font-medium text-muted-foreground min-w-0 w-[150px]">
      {snap.formattedOriginalSize ?? ((snap.originalSize ?? 0) / BYTES_PER_KB).toFixed(1)} KB
    </td>
  );
}
