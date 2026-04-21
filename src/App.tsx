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
import { Toaster } from 'sonner';
import { preview$ } from './store/preview-store';
import { useTheme } from './hooks/useTheme';

const ImagePreviewLazy = lazy(() =>
  import('@/components/preview/ImagePreview').then((m) => ({ default: m.ImagePreview }))
);
const AppFooterFaq = lazy(() =>
  import('@/components/AppFooterFaq').then((m) => ({ default: m.AppFooterFaq }))
);

export default function App() {
  const preview = useValue(preview$);
  const { theme } = useTheme();
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

  useKeyboardShortcuts({
    onDownload: hasFinishedItems ? downloadAll : undefined,
    onEscape: preview ? () => preview$.set(null) : undefined,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors closeButton expand position="bottom-right" theme={theme} />
      <ErrorBoundary>
        <AppHeader />

        <main className="pt-28 md:pt-36 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8 md:gap-10">
          <div className="flex-1 space-y-8 md:space-y-10">
            <Dropzone />

            <Show ifReady={imageStore$.itemOrder}>
              <ResultsTable />
            </Show>
          </div>

          <div className="lg:w-80 w-full shrink-0">
            <ConfigPanel />
          </div>
        </main>

        <AppFooterFaq />

        <FileDropOverlay />

        <Show ifReady={preview$}>
          <Suspense>
            <ImagePreviewLazy
              itemId={preview$.itemId.get() ?? ''}
              selectedResultId={preview$.selectedResultId.get() ?? ''}
              onResultChange={(resultId) => {
                preview$.selectedResultId.set(resultId);
              }}
              onClose={() => preview$.set(null)}
            />
          </Suspense>
        </Show>
      </ErrorBoundary>
    </div>
  );
}
