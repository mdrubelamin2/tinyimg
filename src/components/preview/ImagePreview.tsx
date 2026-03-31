/**
 * ImagePreview: before/after split-view comparison with tabs for multiple formats.
 * Canvas-based with draggable divider for comparing original vs optimized.
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import { X, ZoomIn, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLazyBlobUrl } from '@/hooks/useLazyBlobUrl';
import type { ImageItem } from '@/lib/queue/types';
import { STATUS_SUCCESS } from '@/constants/index';

interface ImagePreviewProps {
  item: ImageItem;
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  onClose: () => void;
}

const MIN_SPLIT = 0.1;
const MAX_SPLIT = 0.9;
const DEFAULT_SPLIT = MAX_SPLIT;

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  item,
  selectedFormat,
  onFormatChange,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const [isDragging, setIsDragging] = useState(false);

  const successResults = useMemo(() => {
    return Object.values(item.results).filter(r => r.status === STATUS_SUCCESS);
  }, [item.results]);

  const currentResult = item.results[selectedFormat];
  const originalUrl = useLazyBlobUrl(item.file);
  const optimizedUrl = useLazyBlobUrl(currentResult?.blob);
  const originalSize = item.originalSize;
  const optimizedSize = currentResult?.size ?? 0;

  const savings = originalSize > 0 && optimizedSize > 0
    ? ((originalSize - optimizedSize) / originalSize * 100).toFixed(1)
    : '0';

  const handleMove = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (clientX - rect.left) / rect.width;
    setSplit(Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, x)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleMove(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  if (!originalUrl || !optimizedUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview comparison for ${item.file.name}`}
    >
      <div
        className="relative bg-surface text-surface-foreground rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <ZoomIn size={18} className="text-primary" />
            <div>
              <h3 className="font-bold text-foreground text-sm truncate max-w-[300px]">
                {item.file.name}
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                {currentResult?.label ?? selectedFormat} · Saved {savings}%
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
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

        {/* Split view */}
        <div
          ref={containerRef}
          className="relative w-full aspect-video bg-muted cursor-ew-resize select-none overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Original (full width behind) */}
          <img
            src={originalUrl}
            alt="Original"
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />

          {/* Optimized (clipped) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${split * 100}%` }}
          >
            <img
              src={optimizedUrl}
              alt="Optimized"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ width: `${100 / split}%`, maxWidth: 'none' }}
              draggable={false}
            />
          </div>

          {/* Divider line */}
          <div
            className={cn(
              "absolute top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-cta shadow-lg shadow-primary/30 transition-opacity",
              isDragging ? "opacity-100" : "opacity-90"
            )}
            style={{ left: `${split * 100}%` }}
          >
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface shadow-lg flex items-center justify-center">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-3 bg-muted-foreground rounded-full" />
                <div className="w-0.5 h-3 bg-muted-foreground rounded-full" />
              </div>
            </div>
          </div>

          {/* Labels */}
          <div
            className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider transition-opacity duration-200"
            style={{ opacity: 0.2 + (split * 0.6) }}
          >
            Optimized · {formatBytes(optimizedSize)}
          </div>
          <div
            className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider transition-opacity duration-200"
            style={{ opacity: 0.2 + ((1 - split) * 0.6) }}
          >
            Original · {formatBytes(originalSize)}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/20">
          <span className="text-[10px] text-muted-foreground font-medium">
            Drag to compare · ESC to close
          </span>
          {optimizedUrl && (
            <a
              href={optimizedUrl}
              download={`tinyimg-${item.file.name.substring(0, item.file.name.lastIndexOf('.'))}.${selectedFormat === 'jpeg' ? 'jpg' : selectedFormat}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-[10px] font-bold shadow-md shadow-primary/25 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer"
              aria-label={`Download ${currentResult?.label ?? selectedFormat}`}
            >
              <Download size={12} />
              <span className="uppercase">{currentResult?.label ?? selectedFormat}</span>
              <span className="opacity-70">·</span>
              <span>{formatBytes(optimizedSize)}</span>
              {savings !== '0' && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">
                  ↓{savings}%
                </span>
              )}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};