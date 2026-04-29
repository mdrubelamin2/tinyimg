import { useObserveEffect, useValue } from '@legendapp/state/react'
import { Activity, lazy } from 'react'
import { Toaster } from 'sonner'

import { AppHeader } from '@/components/AppHeader'
import { ConfigPanel } from '@/components/ConfigPanel'
import { Dropzone } from '@/components/Dropzone'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FileDropOverlay } from '@/components/FileDropOverlay'
import { ResultsTable } from '@/components/ResultsTable'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { syncIntakeProgressToast } from '@/notifications/toast-emitter'
import { queueStats$ } from '@/state/queue-stats'
import { getImageStore, intake$ } from '@/store/image-store'

import PreviewPortal from './components/preview/PreviewPortal'
import { useTheme } from './hooks/use-theme'
import { preview$ } from './store/preview-store'

const AppFooterFaq = lazy(() =>
  import('@/components/AppFooterFaq').then((m) => ({ default: m.AppFooterFaq })),
)

export default function App() {
  const { theme } = useTheme()
  const hasFinishedItems = useValue(() => queueStats$.hasFinishedItems.get())
  const hasItems = useValue(() => queueStats$.itemCount.get() > 0)

  const downloadAll = getImageStore().downloadAll

  useObserveEffect(() => {
    syncIntakeProgressToast(
      intake$.active.get(),
      intake$.label.get(),
      intake$.processed.get(),
      intake$.total.get(),
    )
  })

  useKeyboardShortcuts({
    onDownload: hasFinishedItems ? downloadAll : undefined,
    onEscape: preview$.peek() ? () => preview$.set(null) : undefined,
  })

  return (
    <div className='bg-background text-foreground min-h-screen'>
      <Toaster
        closeButton
        expand
        position='bottom-right'
        richColors
        theme={theme}
      />
      <ErrorBoundary>
        <AppHeader />

        <main className='mx-auto flex max-w-[1600px] flex-col gap-8 px-4 pt-28 pb-12 md:gap-10 md:px-8 md:pt-36 lg:flex-row'>
          <div className='flex-1 space-y-8 md:space-y-10'>
            <Dropzone />

            <Activity mode={hasItems ? 'visible' : 'hidden'}>
              <ResultsTable />
            </Activity>
          </div>

          <div className='w-full shrink-0 lg:w-80'>
            <ConfigPanel />
          </div>
        </main>

        <AppFooterFaq />

        <FileDropOverlay />
        <PreviewPortal />
      </ErrorBoundary>
    </div>
  )
}
