import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Sparkles, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useImageStore } from '@/store/image-store';
import { BYTES_PER_KB, STATUS_SUCCESS, STATUS_ERROR } from '@/constants/index';
import type { ImageItem } from '@/lib/queue/types';

const DOWNLOAD_EXT_JPEG = 'jpg';

export interface ResultRowCellsProps {
  id: string;
  onRemove: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
}

export const ResultRowCells = ({ id, onRemove, onPreview }: ResultRowCellsProps) => {
  const item = useStore(useImageStore, useShallow((state) => state.items.get(id)));

  if (!item) return null;

  return (
    <>
      <div className="px-8 py-5 flex items-center gap-3 min-w-0" role="cell" data-testid="filename-cell">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors duration-200 shadow-sm">
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <Sparkles size={18} />
          )}
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
      <div className="px-6 py-5 text-xs font-medium text-muted-foreground min-w-0" role="cell">
        {(item.originalSize / BYTES_PER_KB).toFixed(1)} KB
      </div>
      <div className="px-6 py-5 min-w-0 overflow-hidden" role="cell">
        <div className="flex flex-wrap gap-2 max-w-full">
          {Object.values(item.results).map(res => {
            const chipClassName = cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors duration-200 min-w-0',
              res.status === STATUS_SUCCESS
                ? 'bg-surface border-border shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-md cursor-pointer'
                : 'bg-muted/50 border-border opacity-60 cursor-default'
            );
            const downloadFilename = `tinyimg-${item.file.name.substring(0, item.file.name.lastIndexOf('.'))}.${res.format === 'jpeg' ? DOWNLOAD_EXT_JPEG : res.format}`;

            return res.status === STATUS_SUCCESS ? (
              <a
                key={res.format}
                href={res.downloadUrl}
                download={downloadFilename}
                className={chipClassName}
                aria-label={`Download ${res.label ?? res.format}`}
                onContextMenu={(e) => {
                  if (onPreview) {
                    e.preventDefault();
                    onPreview(item, res.format);
                  }
                }}
              >
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-wider">
                    {res.label ?? res.format}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      {res.size != null
                        ? (res.size / BYTES_PER_KB).toFixed(1)
                        : '—'}{' '}
                      KB
                    </span>
                    {res.size != null && (
                      <span className="text-[9px] font-black text-success bg-success/15 px-1.5 py-0.5 rounded-full">
                        -
                        {Math.abs(
                          ((item.originalSize - res.size) / item.originalSize) * 100
                        ).toFixed(0)}
                        %
                      </span>
                    )}
                  </div>
                </div>
                <Download size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ) : (
              <div key={res.format} className={chipClassName}>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-wider">
                    {res.label ?? res.format}
                  </span>
                  {res.status === STATUS_ERROR ? (
                    <Badge variant="error" className="text-[9px] px-2 py-1 rounded-full italic">
                      Error
                    </Badge>
                  ) : (
                    <div className="w-12 h-1 bg-muted rounded-full overflow-hidden mt-1">
                      <div className="h-2/5 bg-primary animate-pulse-subtle" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-6 py-5 flex items-center justify-end min-w-0" role="cell">
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
};
