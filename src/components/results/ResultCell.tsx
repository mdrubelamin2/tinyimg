import { memo } from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLazyBlobUrl } from '@/hooks/useLazyBlobUrl';
import { BYTES_PER_KB, STATUS_SUCCESS, STATUS_ERROR } from '@/constants/index';
import type { ImageResult, ImageItem } from '@/lib/queue/types';

const DOWNLOAD_EXT_JPEG = 'jpg';

interface ResultCellProps {
  result: ImageResult;
  item: ImageItem;
  onPreview: ((item: ImageItem) => void) | undefined;
}

export const ResultCell = memo(({ result, item, onPreview }: ResultCellProps) => {
  // Hook at component level - no longer in loop
  const downloadUrl = useLazyBlobUrl(result.blob);

  const chipClassName = cn(
    'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors duration-200 min-w-0',
    result.status === STATUS_SUCCESS
      ? 'bg-surface border-border shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-md cursor-pointer'
      : 'bg-muted/50 border-border opacity-60 cursor-default'
  );

  const downloadFilename = `tinyimg-${item.file.name.substring(0, item.file.name.lastIndexOf('.'))}.${result.format === 'jpeg' ? DOWNLOAD_EXT_JPEG : result.format}`;

  if (result.status === STATUS_SUCCESS && downloadUrl) {
    return (
      <a
        href={downloadUrl}
        download={downloadFilename}
        className={chipClassName}
        aria-label={`Download ${result.label ?? result.format}`}
        onContextMenu={(e) => {
          if (onPreview) {
            e.preventDefault();
            onPreview(item);
          }
        }}
      >
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-wider">
            {result.label ?? result.format}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground">
              {result.formattedSize ?? (result.size != null ? (result.size / BYTES_PER_KB).toFixed(1) : '—')}{' '}
              KB
            </span>
            {result.savingsPercent != null && (
              <span className="text-[9px] font-black text-success bg-success/15 px-1.5 py-0.5 rounded-full">
                -{result.savingsPercent}%
              </span>
            )}
          </div>
        </div>
        <Download size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
      </a>
    );
  }

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <div className={chipClassName}>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-wider">
              {result.label ?? result.format}
            </span>
            {result.status === STATUS_ERROR ? (
              <div className="flex flex-col gap-0.5">
                <Badge variant="error" className="text-[9px] px-2 py-1 rounded-full italic">
                  Error
                </Badge>
              </div>
            ) : (
              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden mt-1">
                <div className="w-full h-full bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-shimmer" />
              </div>
            )}
          </div>
        </div>
      </TooltipTrigger>
      {result.error && (
        <TooltipContent>
          <p className="max-w-xs">{result.error}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
});

ResultCell.displayName = 'ResultCell';
