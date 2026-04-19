import { AppHeader } from '@/components/AppHeader';
import { ConfigPanel } from '@/components/ConfigPanel';
import { Dropzone } from '@/components/Dropzone';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FileDropOverlay } from '@/components/FileDropOverlay';
import { ResultsTable } from '@/components/ResultsTable';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { syncIntakeProgressToast } from '@/notifications/toast-emitter';
import { queueStats$ } from '@/state/queue-stats';
import { getImageStore, imageStore$, intake$ } from '@/store/image-store';
import { Show, useObserveEffect, useValue } from '@legendapp/state/react';
import { lazy, Suspense } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';
import { preview$ } from './store/preview-store';

const ImagePreviewLazy = lazy(() =>
  import('@/components/preview/ImagePreview').then((m) => ({ default: m.ImagePreview }))
);
const AppFooterFaq = lazy(() =>
  import('@/components/AppFooterFaq').then((m) => ({ default: m.AppFooterFaq }))
);

export default function App() {
  const itemCount = useValue(() => imageStore$.itemOrder.get().length);
  const preview = useValue(preview$);
  const hasFinishedItems = useValue(() => queueStats$.hasFinishedItems.get());

  const downloadAll = getImageStore().downloadAll;

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

  useKeyboardShortcuts({
    onDownload: hasFinishedItems ? downloadAll : undefined,
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
              <Dropzone />

              <Show if={() => imageStore$.itemOrder.get().length > 0}>
                <ResultsTable />
              </Show>
            </div>

            <div className="lg:w-80 w-full shrink-0">
              <ConfigPanel />
            </div>
          </main>

          <AppFooterFaq />

          <FileDropOverlay />

          <Show if={() => preview$.get() != null}>
            {() => {
              const p = preview$.get();
              if (!p) return null;
              return (
                <Suspense fallback={null}>
                  <ImagePreviewLazy
                    itemId={p.itemId}
                    selectedResultId={p.selectedResultId}
                    onResultChange={(resultId) => {
                      const cur = preview$.peek();
                      if (cur) preview$.set({ ...cur, selectedResultId: resultId });
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
