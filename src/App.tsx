import { useEffect, useState, useDeferredValue, useCallback, useTransition } from 'react';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { preload, prefetchDNS } from 'react-dom';
import { useAtomValue } from 'jotai';
import { Toaster } from 'react-hot-toast';
import {
  itemOrderAtom,
  itemsArrayAtom,
  itemCountAtom,
  queueStatsAtom,
  allDoneAtom,
  hasErrorsAtom
} from '@/store/atoms/image-atoms';
import {
  useAddFiles,
  useRemoveItem,
  useClearFinished,
  useClearAll,
  useDownloadAll
} from '@/store/atoms/image-actions';
import { settingsAtom } from '@/store/settings-store';
import { Dropzone } from '@/components/Dropzone';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppHeader } from '@/components/AppHeader';
import { ResultsTable } from '@/components/ResultsTable';
import { ImagePreview } from '@/components/preview/ImagePreview';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { performanceMonitor } from '@/lib/performance-monitor';
import confetti from 'canvas-confetti';
import { Zap } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  CONFETTI_PARTICLE_COUNT,
  CONFETTI_SPREAD,
  CONFETTI_ORIGIN_Y,
  CONFETTI_COLORS,
} from '@/constants/index';
import type { ImageItem } from '@/lib/queue/types';

preload('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap', {
  as: 'style',
});

prefetchDNS('https://fonts.googleapis.com');
prefetchDNS('https://fonts.gstatic.com');

interface PreviewState {
  item: ImageItem;
  selectedFormat: string;
}

const FAQ_DATA = [
  {
    question: 'What formats are supported?',
    answer: 'Input: SVG, PNG, JPG, WebP, AVIF, HEIC (Safari), GIF, BMP, TIFF. Output: WebP, AVIF, JPEG, PNG, JXL. SVGs can be optimized or rasterized at display density.',
  },
  {
    question: 'Is my data sent to a server?',
    answer: 'No. Optimization runs entirely in your browser using WebAssembly. Your files never leave your device.',
  },
  {
    question: 'What is the file size limit?',
    answer: '25MB per file. Batch download is capped to avoid memory issues.',
  },
];

const App: React.FC = () => {
  const [, startTransition] = useTransition();
  const itemIds = useAtomValue(itemOrderAtom);
  const itemsArray = useAtomValue(itemsArrayAtom);
  const itemCount = useAtomValue(itemCountAtom);
  const addFiles = useAddFiles();
  const removeItem = useRemoveItem();
  const clearFinished = useClearFinished();
  const clearAll = useClearAll();
  const downloadAll = useDownloadAll();

  const options = useAtomValue(settingsAtom);
  const deferredItemIds = useDeferredValue(itemIds);

  const [preview, setPreview] = useState<PreviewState | null>(null);

  const { savingsPercent, hasFinishedItems, doneCount } = useAtomValue(queueStatsAtom);
  const allDone = useAtomValue(allDoneAtom);
  const hasErrors = useAtomValue(hasErrorsAtom);

  // Initialize performance monitoring
  useEffect(() => {
    performanceMonitor.init();
    
    return () => {
      performanceMonitor.destroy();
    };
  }, []);

  // Confetti on all-done
  useEffect(() => {
    // Check itemsArray.length > 0 because allDone can be true if itemsArray is empty
    if (allDone && !hasErrors && itemsArray.length > 0) {
      confetti({
        particleCount: CONFETTI_PARTICLE_COUNT,
        spread: CONFETTI_SPREAD,
        origin: { y: CONFETTI_ORIGIN_Y },
        colors: [...CONFETTI_COLORS],
      });
    }
  }, [allDone, hasErrors, itemsArray.length]); // Use length instead of array reference

  const handleFilesAdded = useCallback((files: File[] | DataTransferItem[]) => {
    // Wrap in startTransition - file processing is non-urgent and shouldn't block UI
    startTransition(() => {
      void addFiles(files, options);
    });
  }, [addFiles, options, startTransition]);

  // Remove applyGlobalOptions effect - Jotai handles this automatically

  const handlePreview = useCallback((item: ImageItem) => {
    const formats = Object.keys(item.results);
    const firstFormat = formats[0];
    if (!firstFormat) return;
    setPreview({
      item,
      selectedFormat: firstFormat,
    });
  }, []);

  const handleDownloadAll = useCallback(() => {
    void downloadAll();
  }, [downloadAll]);

  useKeyboardShortcuts({
    onDownload: hasFinishedItems ? handleDownloadAll : undefined,
    onEscape: preview ? () => setPreview(null) : undefined,
  });

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (!items || items.length === 0) return;

      const files = Array.from(items).filter(file =>
        file.type.startsWith('image/')
      );

      if (files.length > 0) {
        e.preventDefault();
        handleFilesAdded(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesAdded]);

  return (
    <HelmetProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Helmet>
          <title>TinyIMG - {itemCount > 0 ? `${itemCount} Images Processing` : 'Industrial Image Optimization'}</title>
          <meta name="description" content={itemCount > 0 ? `Processing ${itemCount} images with WASM optimization` : 'Professional-grade image optimization in your browser'} />
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <ErrorBoundary>
          <AppHeader />

          <main className="pt-28 md:pt-36 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8 md:gap-10">
            <div className="flex-1 space-y-8 md:space-y-10">
              <Dropzone onFilesAdded={handleFilesAdded} />

              <ResultsTable
                itemIds={deferredItemIds}
                savingsPercent={savingsPercent}
                hasFinishedItems={hasFinishedItems}
                doneCount={doneCount}
                totalCount={itemCount}
                onClearFinished={clearFinished}
                onDownloadAll={handleDownloadAll}
                onClear={clearAll}
                onRemoveItem={removeItem}
                onPreview={handlePreview}
              />
            </div>

            <div className="lg:w-80 w-full shrink-0">
              <ConfigPanel />
            </div>
          </main>

          <footer className="border-t border-border/50 bg-gradient-to-b from-muted/20 to-transparent">
            <section className="max-w-4xl mx-auto px-4 md:px-8 py-16 text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/10 to-cta/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/10 shadow-sm">
                <Zap size={14} fill="currentColor" className="text-cta" /> Powered by WASM Engines
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight text-balance">
                Industrial grade optimization.{' '}
                <span className="text-primary italic">Browser native.</span>
              </h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed text-balance">
                The definitive alternative to TinyPNG. Recursive folder support, intelligent SVG
                rasterization, before/after preview, and zero data leakage.
              </p>
            </section>
            <section className="max-w-2xl mx-auto px-4 md:px-8 py-10 border-t border-border/50">
              <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-6 text-center">
                FAQ
              </h3>
              <Accordion type="single" collapsible className="w-full">
                {FAQ_DATA.map((faq, i) => (
                  <AccordionItem key={i} value={`item-${i}`}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
            <p className="py-6 text-center text-muted-foreground/60 text-[10px] uppercase tracking-widest font-bold border-t border-border/50">
              &copy; 2026 TinyIMG &bull; Industrial Strength &bull; Pure WASM
            </p>
          </footer>

          {preview ? (
            <ImagePreview
              item={preview.item}
              selectedFormat={preview.selectedFormat}
              onFormatChange={(format) => setPreview({ ...preview, selectedFormat: format })}
              onClose={() => setPreview(null)}
            />
          ) : null}
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              color: '#020617',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '500',
            },
            success: {
              iconTheme: {
                primary: '#0369A1',
                secondary: '#fff',
              },
            },
            loading: {
              iconTheme: {
                primary: '#0369A1',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </HelmetProvider>
  );
};

export default App;
