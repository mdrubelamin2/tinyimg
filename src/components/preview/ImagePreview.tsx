import { ImageCompareViewer } from '@/components/preview/ImageCompareViewer';
import { STATUS_SUCCESS } from '@/constants';
import type { ImageItem } from '@/lib/queue/types';
import { cn } from '@/lib/utils';
import { resolveOriginalSourceFile } from '@/storage/queue-binary';
import { imageStore$ } from '@/store/image-store';
import { useValue } from '@legendapp/state/react';
import { Download, X, ZoomIn } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface ImagePreviewProps {
  itemId: string;
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  onClose: () => void;
}

export function ImagePreview({
  itemId,
  selectedFormat,
  onFormatChange,
  onClose,
}: ImagePreviewProps) {
  const item = useValue(() => imageStore$.items[itemId]?.get() as ImageItem | undefined);

  const [resolvedOriginalObjectUrl, setResolvedOriginalObjectUrl] = useState<string | null>(null);
  const resolvedOriginalRef = useRef<string | null>(null);

  const successResults = useMemo(() => {
    if (!item) return [];
    return Object.values(item.results).filter(r => r.status === STATUS_SUCCESS);
  }, [item]);

  const currentResult = item?.results[selectedFormat];
  const originalUrl = resolvedOriginalObjectUrl;
  const optimizedUrl = currentResult?.downloadUrl;
  const originalSize = item?.originalSize ?? 0;
  const optimizedSize = currentResult?.size ?? 0;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const snap = imageStore$.items[itemId]?.peek() as ImageItem | undefined;
      if (!snap) return;
      const file = await resolveOriginalSourceFile(snap.id, snap);
      if (cancelled || !file) return;
      const url = URL.createObjectURL(file);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      if (resolvedOriginalRef.current) {
        URL.revokeObjectURL(resolvedOriginalRef.current);
      }
      resolvedOriginalRef.current = url;
      setResolvedOriginalObjectUrl(url);
    })();

    return () => {
      cancelled = true;
      if (resolvedOriginalRef.current) {
        URL.revokeObjectURL(resolvedOriginalRef.current);
        resolvedOriginalRef.current = null;
      }
      setResolvedOriginalObjectUrl(null);
    };
  }, [itemId]);

  const savings = originalSize > 0 && optimizedSize > 0
    ? ((originalSize - optimizedSize) / originalSize * 100).toFixed(1)
    : '0';

  const downloadBaseName = useMemo(() => {
    if (!item) return '';
    const d = item.fileName.lastIndexOf('.');
    return d > 0 ? item.fileName.substring(0, d) : item.fileName;
  }, [item]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  if (!item) return null;

  if (!originalUrl || !optimizedUrl) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Loading preview"
      >
        <div
          className="relative bg-surface text-surface-foreground rounded-2xl shadow-2xl px-8 py-6 border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-muted-foreground">Preparing preview…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview comparison for ${item.fileName}`}
    >
      <div
        className="relative flex min-h-0 max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface text-surface-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ZoomIn size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-foreground text-sm truncate min-w-0 max-w-full">
                {item.fileName}
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                {currentResult?.label ?? selectedFormat} · Saved {savings}%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Close preview"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Format Tabs */}
        {successResults.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/50 bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 overflow-x-auto scrollbar-hide">
            {successResults.map((result) => {
              const isActive = result.format === selectedFormat;
              const formatSavings = originalSize > 0 && result.size
                ? ((originalSize - result.size) / originalSize * 100).toFixed(0)
                : null;

              return (
                <button
                  key={result.format}
                  onClick={() => onFormatChange(result.format)}
                  className={cn(
                    'group relative flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-wide transition-all duration-200 ease-out cursor-pointer',
                    isActive
                      ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                  )}
                >
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className={cn(
                      'w-1 h-1 rounded-full',
                      isActive ? 'bg-white/80' : 'bg-muted-foreground/50 group-hover:bg-success'
                    )} />
                    <span className="uppercase">{result.label ?? result.format}</span>
                    {formatSavings && (
                      <span className={cn(
                        'ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black',
                        isActive
                          ? 'bg-white/20 text-white/90'
                          : 'bg-success/20 text-success group-hover:bg-success/30'
                      )}>
                        ↓{formatSavings}%
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="relative aspect-video w-full shrink-0 touch-none select-none overflow-hidden bg-muted min-h-0">
          <div className="absolute inset-0 min-h-0 overflow-hidden">
            <ImageCompareViewer
              originalUrl={originalUrl}
              optimizedUrl={optimizedUrl}
              initialPositionPercent={90}
              className="!rounded-none border-0 bg-transparent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-center text-[10px] font-medium text-muted-foreground sm:text-left">
            Drag to compare. ESC to close
          </span>
          {currentResult?.downloadUrl && (
            <a
              href={currentResult.downloadUrl}
              download={`tinyimg-${downloadBaseName}.${selectedFormat === 'jpeg' ? 'jpg' : selectedFormat}`}
              className="flex cursor-pointer items-center justify-center gap-1.5 self-center rounded-lg bg-gradient-to-r from-primary to-primary/80 px-3 py-2 text-[10px] font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg sm:self-auto sm:py-1.5"
              aria-label={`Download ${currentResult.label ?? selectedFormat}`}
            >
              <Download size={12} />
              <span className="uppercase">{currentResult.label ?? selectedFormat}</span>
              <span className="opacity-70">·</span>
              <span>{formatBytes(optimizedSize)}</span>
              {savings !== '0' && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
                  ↓{savings}%
                </span>
              )}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
