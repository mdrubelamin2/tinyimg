/**
 * ImagePreview: before/after split-view comparison.
 * Canvas-based with draggable divider for comparing original vs optimized.
 */

import { useRef, useState, useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  originalUrl: string;
  optimizedUrl: string;
  originalSize: number;
  optimizedSize: number;
  format: string;
  fileName: string;
  onClose: () => void;
}

const MIN_SPLIT = 0.1;
const MAX_SPLIT = 0.9;
const DEFAULT_SPLIT = 0.5;

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  originalUrl,
  optimizedUrl,
  originalSize,
  optimizedSize,
  format,
  fileName,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const [isDragging, setIsDragging] = useState(false);

  const savings = originalSize > 0
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

  // ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview comparison for ${fileName}`}
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
                {fileName}
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                {format} · Saved {savings}%
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

        {/* Split view */}
        <div
          ref={containerRef}
          className="relative w-full aspect-video bg-muted cursor-col-resize select-none overflow-hidden"
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
              "absolute top-0 bottom-0 w-0.5 bg-white shadow-lg transition-opacity",
              isDragging ? "opacity-100" : "opacity-70"
            )}
            style={{ left: `${split * 100}%` }}
          >
            <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface shadow-lg border border-border flex items-center justify-center">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-3 bg-muted-foreground rounded-full" />
                <div className="w-0.5 h-3 bg-muted-foreground rounded-full" />
              </div>
            </div>
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider">
            Optimized · {formatBytes(optimizedSize)}
          </div>
          <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider">
            Original · {formatBytes(originalSize)}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 text-center text-[10px] text-muted-foreground font-medium border-t border-border">
          Drag the divider to compare · Press ESC to close
        </div>
      </div>
    </div>
  );
};
