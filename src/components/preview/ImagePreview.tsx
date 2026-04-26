import { ImageCompareViewer } from '@/components/preview/ImageCompareViewer';
import { BYTES_PER_KB, STATUS_SUCCESS, mimeForOutputFormat } from '@/constants';
import { downloadStoredOutput } from '@/lib/download';
import type { ImageItem, ImageResult } from '@/lib/queue/types';
import { buildOptimizedDownloadFilename } from '@/lib/result-download-name';
import { cn } from '@/lib/utils';
import { isHeicDecodeLikelySupported } from '@/lib/validation';
import { createTransientObjectUrlForPayloadKey, resolveOriginalSourceFile } from '@/storage/queue-binary';
import { imageStore$ } from '@/store/image-store';
import { useValue } from '@legendapp/state/react';
import { Download, X, ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState, ViewTransition } from 'react';

interface ImagePreviewProps {
  itemId: string;
  selectedResultId: string;
  onResultChange: (resultId: string) => void;
  onClose: () => void;
}

function chipTitleForResult(result: ImageResult): string {
  if (result.variantLabel != null && result.variantLabel.length > 0) {
    return `${result.format.toUpperCase()} · ${result.variantLabel}`;
  }
  return result.label ?? result.format;
}

const ImagePreview = ({
  itemId,
  selectedResultId,
  onResultChange,
  onClose,
}: ImagePreviewProps) => {
  const item = useValue(() => imageStore$.items[itemId]?.get());

  const [resolvedOriginalObjectUrl, setResolvedOriginalObjectUrl] = useState<string | null>(null);
  const resolvedOriginalRef = useRef<string | null>(null);

  const [optimizedObjectUrl, setOptimizedObjectUrl] = useState<string | null>(null);
  const optimizedRef = useRef<string | null>(null);

  const successResults = item
    ? Object.values(item.results)
        .filter(r => r.status === STATUS_SUCCESS)
        .sort((a, b) => a.resultId.localeCompare(b.resultId))
    : [];

  const currentResult = item?.results[selectedResultId];
  const originalUrl = resolvedOriginalObjectUrl;
  const optimizedUrl = optimizedObjectUrl;
  const originalSize = item?.originalSize ?? 0;
  const optimizedSize = currentResult?.size ?? 0;

  const isPreviewSupported = (format: string | undefined) => {
    if (isHeicDecodeLikelySupported()) {
      return true;
    }
    return !(format === 'heic' || format === 'heif');
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const snap = imageStore$.items[itemId]?.peek() as ImageItem | undefined;
      if (!snap) return;
      console.log('is supported', isPreviewSupported(snap.originalFormat), snap.originalFormat);
      if(!isPreviewSupported(snap.originalFormat)) {
        return;
      }
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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const snap = imageStore$.items[itemId]?.peek() as ImageItem | undefined;
      const r = snap?.results[selectedResultId];
      if(!isPreviewSupported(r?.format)) {
        return;
      }
      if (!r || r.status !== STATUS_SUCCESS || !r.payloadKey) {
        if (optimizedRef.current) {
          URL.revokeObjectURL(optimizedRef.current);
          optimizedRef.current = null;
        }
        setOptimizedObjectUrl(null);
        return;
      }
      const mime = mimeForOutputFormat(r.format);
      const url = await createTransientObjectUrlForPayloadKey(r.payloadKey, mime);
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      if (optimizedRef.current) {
        URL.revokeObjectURL(optimizedRef.current);
      }
      optimizedRef.current = url;
      setOptimizedObjectUrl(url);
    })();

    return () => {
      cancelled = true;
      if (optimizedRef.current) {
        URL.revokeObjectURL(optimizedRef.current);
        optimizedRef.current = null;
      }
      setOptimizedObjectUrl(null);
    };
  }, [itemId, selectedResultId, currentResult?.payloadKey, currentResult?.status]);

  const savings = originalSize > 0 && optimizedSize > 0
    ? ((originalSize - optimizedSize) / originalSize * 100).toFixed(1)
    : '0';

  const lastDotIndex = item?.fileName.lastIndexOf('.') ?? -1;
  const downloadBaseName = lastDotIndex > 0 ? item!.fileName.substring(0, lastDotIndex) : (item?.fileName ?? '');

  const formatBytes = (bytes: number) => {
    if (bytes < BYTES_PER_KB) return `${bytes} B`;
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  };

  if (!item) return null;

  return (
    <ViewTransition>
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
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
                  {currentResult ? chipTitleForResult(currentResult) : '…'} · Saved {savings}%
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
                const isActive = result.resultId === selectedResultId;
                const formatSavings = originalSize > 0 && result.size
                  ? ((originalSize - result.size) / originalSize * 100).toFixed(0)
                  : null;

                return (
                  <button
                    key={result.resultId}
                    onClick={() => onResultChange(result.resultId)}
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
                      <span className="uppercase">{chipTitleForResult(result)}</span>
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
              {!originalUrl && !optimizedUrl && (
                <div className="flex flex-col items-center gap-2 justify-center h-full">
                  <p className="text-sm text-muted-foreground">Image Preview not available</p>
                </div>
              )}
              {originalUrl && !optimizedUrl && (
                <img
                  src={originalUrl}
                  alt={`Original ${item.fileName}`}
                  className="object-contain w-full h-full"
                />
              )}
              {!originalUrl && optimizedUrl && (
                <img
                src={optimizedUrl}
                  alt={`Optimized ${item.fileName}`}
                  className="object-contain w-full h-full"
                />
              )}
              {originalUrl && optimizedUrl && (
              <ImageCompareViewer
                originalUrl={originalUrl}
                optimizedUrl={optimizedUrl}
                initialPositionPercent={90}
                className="!rounded-none border-0 bg-transparent"
              />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span className="text-center text-[10px] font-medium text-muted-foreground sm:text-left">
              Drag to compare. ESC to close
            </span>
            {currentResult?.payloadKey && (
              <button
                type="button"
                onClick={() => {
                  if (!currentResult.payloadKey) return;
                  void downloadStoredOutput(
                    currentResult.payloadKey,
                    currentResult.format,
                    buildOptimizedDownloadFilename(downloadBaseName, currentResult)
                  );
                }}
                className="flex cursor-pointer items-center justify-center gap-1.5 self-center rounded-lg bg-gradient-to-r from-primary to-primary/80 px-3 py-2 text-[10px] font-bold text-primary-foreground shadow-md shadow-primary/25 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg sm:self-auto sm:py-1.5"
                aria-label={`Download ${chipTitleForResult(currentResult)}`}
              >
                <Download size={12} />
                <span className="uppercase">{chipTitleForResult(currentResult)}</span>
                <span className="opacity-70">·</span>
                <span>{formatBytes(optimizedSize)}</span>
                {savings !== '0' && (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9px]">
                    ↓{savings}%
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}

export default ImagePreview;
