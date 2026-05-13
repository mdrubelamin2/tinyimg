import { useValue } from '@legendapp/state/react'
import { lazy, startTransition, Suspense, useEffect, useState } from 'react'

import { preview$ } from '@/store/preview-store'

const ImagePreviewLazy = lazy(() => import('@/components/preview/ImagePreview'))

const PreviewPortal = () => {
  const preview = useValue(preview$)
  const [previewSt, setPreviewSt] = useState(preview)

  useEffect(() => {
    if (preview !== previewSt) {
      startTransition(() => {
        setPreviewSt(preview)
      })
    }
  }, [preview, previewSt])

  return (
    <div>
      {previewSt ? (
        <Suspense>
          <ImagePreviewLazy
            itemId={previewSt.itemId}
            onClose={() => preview$.set(null)}
            onResultChange={(resultId) => {
              preview$.selectedResultId.set(resultId)
            }}
            selectedResultId={previewSt.selectedResultId}
          />
        </Suspense>
      ) : null}
    </div>
  )
}

export default PreviewPortal
