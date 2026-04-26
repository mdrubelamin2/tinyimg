import { AppHeader } from '@/components/AppHeader';
import { ConfigPanel } from '@/components/ConfigPanel';
import { Dropzone } from '@/components/Dropzone';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FileDropOverlay } from '@/components/FileDropOverlay';
import { ResultsTable } from '@/components/ResultsTable';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { syncIntakeProgressToast } from '@/notifications/toast-emitter';
import { queueStats$ } from '@/state/queue-stats';
import { getImageStore, intake$ } from '@/store/image-store';
import { useObserveEffect, useValue } from '@legendapp/state/react';
import { Activity, lazy } from 'react';
import { Toaster } from 'sonner';
import PreviewPortal from './components/preview/PreviewPortal';
import { useTheme } from './hooks/useTheme';
import { preview$ } from './store/preview-store';

const AppFooterFaq = lazy(() =>
  import('@/components/AppFooterFaq').then((m) => ({ default: m.AppFooterFaq }))
);

export default function App() {
  const { theme } = useTheme();
  const hasFinishedItems = useValue(() => queueStats$.hasFinishedItems.get());
  const hasItems = useValue(() => queueStats$.itemCount.get() > 0)

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
    onEscape: preview$.peek() ? () => preview$.set(null) : undefined,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors closeButton expand position="bottom-right" theme={theme} />
      <ErrorBoundary>
        <AppHeader />

        <main className="pt-28 md:pt-36 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8 md:gap-10">
          <div className="flex-1 space-y-8 md:space-y-10">
            <Dropzone />

            <Activity mode={hasItems ? 'visible' : 'hidden'}>
              <ResultsTable />
            </Activity>
          </div>

          <div className="lg:w-80 w-full shrink-0">
            <ConfigPanel />
          </div>
        </main>

        <AppFooterFaq />

        <FileDropOverlay />
        <PreviewPortal />
      </ErrorBoundary>
    </div>
  );
}
