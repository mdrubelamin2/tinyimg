import { useValue } from '@legendapp/state/react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { imageStore$ } from '@/store/image-store';
import {
  BYTES_PER_KB,
  STATUS_SUCCESS,
  STATUS_ERROR,
  STATUS_PROCESSING,
} from '@/constants';
import { buildOptimizedDownloadFilename } from '@/lib/result-download-name';

export function FormatChipsCellTable({
  id,
}: {
  id: string;
}) {
  const snap = useValue(() => {
    const node = imageStore$.items[id];
    if (!node) return undefined;
    return {
      results: node.results.get(),
      fileName: node.fileName.get(),
    };
  });

  if (!snap) return null;

  const { results = {}, fileName = '' } = snap;

  return (
    <td className="px-3 py-4 align-middle min-w-0 md:px-6 md:py-5">
      <div className="flex w-full min-w-0 flex-wrap content-start gap-2">
        {Object.values(results).map((res) => {
          const chipClassName = cn(
            'flex shrink-0 items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors duration-200 min-w-0',
            res.status === STATUS_SUCCESS
              ? 'bg-surface border-border shadow-sm hover:border-primary/50 hover:bg-primary/5 hover:shadow-md cursor-pointer'
              : 'bg-muted/50 border-border opacity-60 cursor-default'
          );
          const dot = fileName.lastIndexOf('.');
          const base = dot > 0 ? fileName.substring(0, dot) : fileName;
          const downloadFilename = buildOptimizedDownloadFilename(base, res);
          const chipTitle =
            res.variantLabel && res.variantLabel.length > 0
              ? `${(res.format ?? '').toUpperCase()} · ${res.variantLabel}`
              : (res.label ?? res.format);

          return res.status === STATUS_SUCCESS ? (
            <a
              key={res.resultId}
              href={res.downloadUrl}
              download={downloadFilename}
              className={chipClassName}
              aria-label={`Download ${chipTitle}`}
            >
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-wider">
                  {chipTitle}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {res.formattedSize ?? (res.size != null ? (res.size / BYTES_PER_KB).toFixed(1) : '—')} KB
                  </span>
                  {res.savingsPercent != null && (
                    <span className="text-[9px] font-black text-success bg-success/15 px-1.5 py-0.5 rounded-full">
                      -{res.savingsPercent}%
                    </span>
                  )}
                </div>
              </div>
              <Download size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ) : (
            <div key={res.resultId} className={chipClassName}>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1 tracking-wider">
                  {chipTitle}
                </span>
                {res.status === STATUS_ERROR ? (
                  <Badge variant="error" className="text-[9px] px-2 py-1 rounded-full italic">
                    Error
                  </Badge>
                ) : res.status === STATUS_PROCESSING ? (
                  <div className="w-12 h-1 bg-muted rounded-full overflow-hidden mt-1">
                    <div className="w-full h-full bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-shimmer" />
                  </div>
                ) : (
                  <div className="w-12 h-1 bg-muted rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-primary/50 rounded-full" style={{ width: '40%' }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </td>
  );
}
