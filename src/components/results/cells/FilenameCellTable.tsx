import { useValue } from '@legendapp/state/react';
import { Eye } from 'lucide-react';
import { imageStore$ } from '@/store/image-store';
import { thumbnailCachePeek } from '@/thumbnails/thumbnail-cache';
import type { ImageItem } from '@/lib/queue/types';

export function FilenameCellTable({
  id,
  onPreview,
}: {
  id: string;
  onPreview?: (item: ImageItem) => void;
}) {
  const snap = useValue(() => {
    const node = imageStore$.items[id];
    if (!node) return undefined;
    return {
      previewUrl: node.previewUrl.get(),
      fileName: node.fileName.get(),
      originalFormat: node.originalFormat.get(),
    };
  });

  if (!snap) return null;

  const thumbUrl = thumbnailCachePeek(id) ?? snap.previewUrl;

  const handlePreview = () => {
    const item = imageStore$.items[id]?.peek() as ImageItem | undefined;
    if (item) onPreview?.(item);
  };

  return (
    <td className="px-3 py-4 align-middle min-w-0 md:px-6 lg:px-8 md:py-5" data-testid="filename-cell">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 group-hover:bg-primary/10 transition-colors duration-200 shadow-sm relative cursor-pointer"
          onClick={handlePreview}
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt=""
              className="w-full h-full object-cover"
              decoding="async"
              fetchPriority="low"
            />
          ) : (
            <div
              className="absolute inset-0 overflow-hidden rounded-[inherit] bg-muted/70"
              aria-hidden
            >
              <div className="h-full w-full bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent animate-thumbnail-shimmer" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-xl">
            <Eye size={16} className="text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p
            className="text-sm font-semibold text-foreground truncate min-w-0 w-full max-w-full md:max-w-[28rem]"
            data-testid="filename"
          >
            {snap.fileName}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono tracking-tighter uppercase">
            {snap.originalFormat}
          </p>
        </div>
      </div>
    </td>
  );
}
