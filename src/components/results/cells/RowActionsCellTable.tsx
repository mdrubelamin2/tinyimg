import { useValue } from '@legendapp/state/react';
import { Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { imageStore$ } from '@/store/image-store';
import type { ImageItem } from '@/lib/queue/types';

export function RowActionsCellTable({
  id,
  onRemove,
  onPreview,
}: {
  id: string;
  onRemove: (id: string) => void;
  onPreview?: (item: ImageItem) => void;
}) {
  const fileName = useValue(() => {
    const node = imageStore$.items[id];
    if (!node) return undefined;
    return node.fileName.get();
  });

  if (fileName === undefined) return null;

  const handlePreview = () => {
    const item = imageStore$.items[id]?.peek() as ImageItem | undefined;
    if (item) onPreview?.(item);
  };

  return (
    <td className="px-2 py-4 align-middle md:px-6 md:py-5">
      <div className="inline-flex w-full flex-wrap items-center justify-end gap-0.5 align-middle md:gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreview}
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors duration-200 size-6"
          title="Preview"
          aria-label={`Preview ${fileName}`}
        >
          <Eye size={17} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(id)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors duration-200 size-6"
          title="Remove item"
          aria-label={`Remove ${fileName}`}
        >
          <Trash2 size={17} />
        </Button>
      </div>
    </td>
  );
}
