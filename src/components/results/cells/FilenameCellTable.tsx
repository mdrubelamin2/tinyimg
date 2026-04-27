import { Memo, Computed } from '@legendapp/state/react';
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
  const node = imageStore$.items[id];

  if (!node) return null;

  const handlePreview = () => {
    const item = node.peek() as ImageItem | undefined;
    if (item) onPreview?.(item);
  };

  return (
    <div className="p-2 align-middle min-w-0 md:px-6 lg:px-8 md:py-5" data-testid="filename-cell">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 group-hover:bg-primary/10 transition-colors duration-200 shadow-sm relative cursor-pointer"
          onClick={handlePreview}
        >
          <Memo>
            {() => {
              const previewUrl = node.previewUrl.get();
              const thumbUrl = thumbnailCachePeek(id) ?? previewUrl;

              return thumbUrl ? (
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
              );
            }}
          </Memo>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-xl">
            <Eye size={16} className="text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p
            className="text-sm font-semibold text-foreground truncate min-w-0 w-full max-w-full md:max-w-[28rem]"
            data-testid="filename"
          >
            <Computed>{() => node.fileName.get()}</Computed>
          </p>
          <p className="text-[10px] text-muted-foreground font-mono tracking-tighter uppercase">
            <Computed>{() => node.originalFormat.get()}</Computed>
          </p>
        </div>
      </div>
    </div>
  );
}
