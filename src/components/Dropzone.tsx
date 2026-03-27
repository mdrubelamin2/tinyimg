import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '../lib/utils';

interface DropzoneProps {
  onFilesAdded: (files: File[] | DataTransferItem[]) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({ onFilesAdded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const items = e.dataTransfer.items ?? e.dataTransfer.files;
    onFilesAdded(Array.from(items));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesAdded(Array.from(e.target.files));
    }
  };

  return (
    <div className="w-full mx-auto space-y-6 animate-slide-up">
      <button
        type="button"
        onClick={openFileDialog}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={onDrop}
        className={cn(
          'w-full relative group cursor-pointer rounded-3xl border-2 border-dashed transition-colors duration-200 min-h-[250px] md:min-h-[300px] flex flex-col items-center justify-center p-6 md:p-12 glass overflow-hidden',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border/70 hover:border-primary/60 hover:bg-primary/[0.03] shadow-xl'
        )}
        aria-label="Drop files or click to select"
      >
        <div className="relative flex flex-col items-center text-center space-y-6 pointer-events-none">
          <div className="p-5 md:p-6 rounded-2xl bg-primary/5 text-primary group-hover:scale-105 transition-transform duration-200 shadow-sm">
            <Upload size={36} className="md:w-11 md:h-11" strokeWidth={1.5} />
          </div>
          <div className="px-4 space-y-2">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Drop your assets here
            </h3>
            <p className="text-sm text-muted-foreground max-w-md font-medium leading-relaxed">
              SVG, PNG, JPG, WebP, AVIF, GIF, BMP, TIFF, HEIC (Safari), folders & ZIPs.
              <br />
              <span className="text-muted-foreground/80">Highly private.</span>{' '}
              <span className="text-primary font-bold">Max 25MB.</span>
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-subtle" />
            Click to browse
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".svg,.png,.webp,.avif,.jpg,.jpeg,.gif,.bmp,.tif,.tiff,.heic,.heif,.zip"
          className="sr-only"
          aria-hidden
          onChange={handleFileInputChange}
        />
      </button>
    </div>
  );
};
