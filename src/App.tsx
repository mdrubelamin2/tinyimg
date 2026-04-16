import { lazy, Suspense, useEffect, useCallback, useRef, useLayoutEffect, useState } from 'react';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Show, useObserveEffect, useObservable, useValue } from '@legendapp/state/react';
import { Toaster } from 'sonner';
import { imageStore$, intake$, getImageStore } from '@/store/image-store';
import { useSettingsStore } from '@/store/settings-store';
import { subscribeCpuPressureToast } from '@/capabilities/cpu-pressure';
import { clearSessionStorage } from '@/storage/hybrid-storage';
import { clearDirectDropOriginals } from '@/storage/dropped-original-files';
import { startSessionQuotaMonitor } from '@/storage/quota-monitor';
import { syncIntakeProgressToast } from '@/notifications/toast-emitter';
import { Dropzone } from '@/components/Dropzone';
import { FileDropOverlay } from '@/components/FileDropOverlay';
import { ConfigPanel } from '@/components/ConfigPanel';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppHeader } from '@/components/AppHeader';
import { ResultsTable } from '@/components/ResultsTable';
import { useQueueStats } from '@/hooks/useQueueStats';
import { queueStats$ } from '@/state/queue-stats';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  CONFETTI_PARTICLE_COUNT,
  CONFETTI_SPREAD,
  CONFETTI_ORIGIN_Y,
  CONFETTI_COLORS,
} from '@/constants';
import type { ImageItem } from '@/lib/queue/types';

const ImagePreviewLazy = lazy(() =>
  import('@/components/preview/ImagePreview').then((m) => ({ default: m.ImagePreview }))
);
const AppFooterFaq = lazy(() =>
  import('@/components/AppFooterFaq').then((m) => ({ default: m.AppFooterFaq }))
);

interface PreviewState {
  itemId: string;
  selectedFormat: string;
}

const App: React.FC = () => {
  const itemCount = useValue(() => imageStore$.itemOrder.get().length);
  const preview$ = useObservable<PreviewState | null>(null);
  const preview = useValue(preview$);
  const addFiles = getImageStore().addFiles;
  const removeItem = getImageStore().removeItem;
  const clearFinished = getImageStore().clearFinished;
  const clearAll = getImageStore().clearAll;
  const downloadAll = getImageStore().downloadAll;
  const applyGlobalOptions = getImageStore().applyGlobalOptions;

  const options = useSettingsStore((state) => state.options);

  const fileDragDepthRef = useRef(0);
  const [fileDropOverlayOpen, setFileDropOverlayOpen] = useState(false);

  const syncFileDragDepth = useCallback((next: number) => {
    const n = Math.max(0, next);
    fileDragDepthRef.current = n;
    setFileDropOverlayOpen(n > 0);
  }, []);

  const { hasFinishedItems, estimatedSavingsLabel, allSuccessful } = useQueueStats();

  useObserveEffect(() => {
    syncIntakeProgressToast(
      intake$.active.get(),
      intake$.label.get(),
      intake$.processed.get(),
      intake$.total.get()
    );
  });

  useObserveEffect(() => {
    const n = imageStore$.itemOrder.get().length;
    const { savingsPercent: pct, hasFinishedItems: finished } = queueStats$.get();
    const helmetTitle =
      n > 0 ? (finished ? `${n} images · ${pct}% saved` : `${n} images processing`) : 'Industrial Image Optimization';
    document.title = `TinyIMG — ${helmetTitle}`;
  });

  const sessionClearedRef = useRef(false);
  useLayoutEffect(() => {
    if (sessionClearedRef.current) return;
    sessionClearedRef.current = true;
    void clearSessionStorage();
    clearDirectDropOriginals();
  }, []);

  useEffect(() => {
    const stopQuota = startSessionQuotaMonitor();
    const stopCpu = subscribeCpuPressureToast();
    return () => {
      stopQuota();
      stopCpu();
    };
  }, []);

  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (allSuccessful) {
      if (!confettiFiredRef.current) {
        confettiFiredRef.current = true;
        void import('canvas-confetti').then(({ default: confetti }) => {
          confetti({
            particleCount: CONFETTI_PARTICLE_COUNT,
            spread: CONFETTI_SPREAD,
            origin: { y: CONFETTI_ORIGIN_Y },
            colors: [...CONFETTI_COLORS],
          });
        });
      }
    } else {
      confettiFiredRef.current = false;
    }
  }, [allSuccessful]);

  const handleFilesAdded = useCallback(
    (files: File[] | DataTransferItem[]) => {
      void addFiles(files, options);
    },
    [addFiles, options]
  );

  useEffect(() => {
    if (itemCount > 0) {
      applyGlobalOptions(options, false);
    }
  }, [options, itemCount, applyGlobalOptions]);

  const handlePreview = useCallback(
    (item: ImageItem) => {
      const formats = Object.keys(item.results);
      const firstFormat = formats[0];
      if (!firstFormat) return;
      preview$.set({
        itemId: item.id,
        selectedFormat: firstFormat,
      });
    },
    [preview$]
  );

  const handleDownloadAll = useCallback(() => {
    void downloadAll();
  }, [downloadAll]);

  useKeyboardShortcuts({
    onDownload: hasFinishedItems ? handleDownloadAll : undefined,
    onEscape: preview ? () => preview$.set(null) : undefined,
  });

  useEffect(() => {
    const hasFilePayload = (e: DragEvent) =>
      Boolean(e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files'));

    const onDocumentDragEnter = (e: DragEvent) => {
      if (!hasFilePayload(e)) return;
      e.preventDefault();
      syncFileDragDepth(fileDragDepthRef.current + 1);
    };

    const onDocumentDragLeave = (e: DragEvent) => {
      if (!hasFilePayload(e)) return;
      syncFileDragDepth(fileDragDepthRef.current - 1);
    };

    const onWindowDragOver = (e: DragEvent) => {
      if (!hasFilePayload(e)) return;
      e.preventDefault();
    };

    /** Runs in capture phase so overlay clears even when a child calls stopPropagation on drop. */
    const onWindowDropCapture = () => {
      syncFileDragDepth(0);
    };

    const onWindowDropBubble = (e: DragEvent) => {
      if (!hasFilePayload(e)) return;
      e.preventDefault();
      const dt = e.dataTransfer;
      if (!dt) return;
      const items = dt.items;
      if (items && items.length > 0) {
        handleFilesAdded(Array.from(items));
      } else if (dt.files?.length) {
        handleFilesAdded(Array.from(dt.files));
      }
    };

    const onDragEnd = () => {
      syncFileDragDepth(0);
    };

    document.addEventListener('dragenter', onDocumentDragEnter);
    document.addEventListener('dragleave', onDocumentDragLeave);
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDropCapture, true);
    window.addEventListener('drop', onWindowDropBubble, false);
    window.addEventListener('dragend', onDragEnd);

    return () => {
      document.removeEventListener('dragenter', onDocumentDragEnter);
      document.removeEventListener('dragleave', onDocumentDragLeave);
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDropCapture, true);
      window.removeEventListener('drop', onWindowDropBubble, false);
      window.removeEventListener('dragend', onDragEnd);
    };
  }, [handleFilesAdded, syncFileDragDepth]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (!items || items.length === 0) return;

      const files = Array.from(items).filter((file) => file.type.startsWith('image/'));

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
        <Toaster richColors closeButton position="bottom-right" />
        <Helmet>
          <meta
            name="description"
            content={
              itemCount > 0
                ? `Processing ${itemCount} images with WASM optimization`
                : 'Professional-grade image optimization in your browser'
            }
          />
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <ErrorBoundary>
          <AppHeader subtitle={estimatedSavingsLabel || undefined} />

          <main className="pt-28 md:pt-36 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8 md:gap-10">
            <div className="flex-1 space-y-8 md:space-y-10">
              <Dropzone onFilesAdded={handleFilesAdded} />

              <Show if={() => true}>
                {() => {
                  const itemIds = imageStore$.itemOrder.get();
                  if (itemIds.length === 0) return null;
                  const stats = queueStats$.get();
                  return (
                    <ResultsTable
                      itemIds={[...itemIds]}
                      savingsPercent={stats.savingsPercent}
                      hasFinishedItems={stats.hasFinishedItems}
                      doneCount={stats.doneCount}
                      totalCount={itemIds.length}
                      onClearFinished={clearFinished}
                      onDownloadAll={handleDownloadAll}
                      onClear={clearAll}
                      onRemoveItem={removeItem}
                      onPreview={handlePreview}
                    />
                  );
                }}
              </Show>
            </div>

            <div className="lg:w-80 w-full shrink-0">
              <ConfigPanel />
            </div>
          </main>

          <Suspense fallback={null}>
            <AppFooterFaq />
          </Suspense>

          <FileDropOverlay open={fileDropOverlayOpen} />

          <Show if={() => preview$.get() != null}>
            {() => {
              const p = preview$.get();
              if (!p) return null;
              return (
                <Suspense fallback={null}>
                  <ImagePreviewLazy
                    itemId={p.itemId}
                    selectedFormat={p.selectedFormat}
                    onFormatChange={(format) => {
                      const cur = preview$.peek();
                      if (cur) preview$.set({ ...cur, selectedFormat: format });
                    }}
                    onClose={() => preview$.set(null)}
                  />
                </Suspense>
              );
            }}
          </Show>
        </ErrorBoundary>
      </div>
    </HelmetProvider>
  );
};

export default App;
