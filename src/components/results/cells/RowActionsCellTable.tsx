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
    <td className="px-6 py-5 align-middle w-[100px] min-w-[100px]">
      <div className="flex items-center justify-end min-w-0 gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreview}
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors duration-200 w-10 h-10"
          title="Preview"
          aria-label={`Preview ${fileName}`}
        >
          <Eye size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(id)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors duration-200 w-10 h-10"
          title="Remove item"
          aria-label={`Remove ${fileName}`}
        >
          <Trash2 size={18} />
        </Button>
      </div>
    </td>
  );
}
