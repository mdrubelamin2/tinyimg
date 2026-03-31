import { memo } from 'react';
import { useAtomValue } from 'jotai';
import { Sparkles, Trash2, Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useLazyBlobUrl } from '@/hooks/useLazyBlobUrl';
import { imageItemAtomFamily } from '@/store/atoms/image-atoms';
import { ResultCell } from './ResultCell';
import { BYTES_PER_KB, STATUS_CHECKING } from '@/constants/index';
import type { ImageItem } from '@/lib/queue/types';

export interface ResultRowCellsProps {
  id: string;
  onRemove: (id: string) => void;
  onPreview: ((item: ImageItem) => void) | undefined;
}

export const ResultRowCells = memo(({ id, onRemove, onPreview }: ResultRowCellsProps) => {
  const item = useAtomValue(imageItemAtomFamily(id));
  // Use lazy blob URL (now using useMemo, no performance issue)
  const previewUrl = useLazyBlobUrl(item?.file);

  if (!item) return null;

  return (
    <>
      <div className="px-8 py-5 flex items-center gap-3 min-w-0" role="cell" data-testid="filename-cell">
        <div
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-200 shadow-sm relative cursor-pointer"
          onClick={() => onPreview?.(item)}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <Sparkles size={18} />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center rounded-xl">
            <Eye size={16} className="text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate max-w-[150px] md:max-w-[250px]" data-testid="filename">
            {item.file.name}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono tracking-tighter uppercase">
            {item.originalFormat}
          </p>
        </div>
      </div>
      <div className="px-6 py-5 text-xs font-medium text-muted-foreground min-w-0 flex items-center" role="cell">
        {item.formattedOriginalSize ?? (item.originalSize / BYTES_PER_KB).toFixed(1)} KB
      </div>
      <div className="px-6 py-5 min-w-0 overflow-hidden" role="cell">
        {item.status === STATUS_CHECKING ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-xs">Checking dimensions...</span>
          </div>
        ) : (
          <TooltipProvider delayDuration={0}>
            <div className="flex flex-wrap gap-2 max-w-full">
              {Object.values(item.results).map(res => (
                <ResultCell key={res.format} result={res} item={item} onPreview={onPreview ?? undefined} />
              ))}
            </div>
          </TooltipProvider>
        )}
      </div>
      <div className="px-6 py-5 flex items-center justify-end min-w-0 gap-1" role="cell">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPreview?.(item)}
          className="text-muted-foreground hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors duration-200 w-10 h-10"
          title="Preview"
          aria-label={`Preview ${item.file.name}`}
        >
          <Eye size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(item.id)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors duration-200 w-10 h-10"
          title="Remove item"
          aria-label={`Remove ${item.file.name}`}
        >
          <Trash2 size={18} />
        </Button>
      </div>
    </>
  );
});
