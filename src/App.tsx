import { lazy, Suspense, useCallback } from 'react';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Show, useObserveEffect, useObservable, useValue } from '@legendapp/state/react';
import { Toaster } from 'sonner';
import { imageStore$, intake$, getImageStore } from '@/store/image-store';
import { useSettingsStore } from '@/store/settings-store';
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
import { useFileDropOverlayOpen } from '@/hooks/useFileDropOverlayOpen';
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

export default function App() {
  const itemCount = useValue(() => imageStore$.itemOrder.get().length);
  const preview$ = useObservable<PreviewState | null>(null);
  const preview = useValue(preview$);
  const addFiles = getImageStore().addFiles;
  const removeItem = getImageStore().removeItem;
  const clearFinished = getImageStore().clearFinished;
  const clearAll = getImageStore().clearAll;
  const downloadAll = getImageStore().downloadAll;

  const options = useSettingsStore((state) => state.options);

  const fileDropOverlayOpen = useFileDropOverlayOpen();

  const { hasFinishedItems } = useQueueStats();

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

  const handleFilesAdded = useCallback(
    (files: File[] | DataTransferItem[]) => {
      void addFiles(files, options);
    },
    [addFiles, options]
  );

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
          <AppHeader />

          <main className="pt-28 md:pt-36 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8 md:gap-10">
            <div className="flex-1 space-y-8 md:space-y-10">
              <Dropzone onFilesAdded={handleFilesAdded} />

              <Show if={() => imageStore$.itemOrder.get().length > 0}>
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
}
