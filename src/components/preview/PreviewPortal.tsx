import { preview$ } from '@/store/preview-store';
import { useValue } from '@legendapp/state/react';
import { lazy, startTransition, Suspense, useEffect, useState } from 'react';

const ImagePreviewLazy = lazy(() => import('@/components/preview/ImagePreview'));

const PreviewPortal = () => {
  const preview = useValue(preview$);
  const [previewSt, setPreviewSt] = useState(preview);

  useEffect(() => {
    if (preview !== previewSt) {
      startTransition(() => {
        setPreviewSt(preview);
      });
    }
  }, [preview, previewSt]);

  return (
    <div>
      {previewSt ? (
        <Suspense>
          <ImagePreviewLazy
            itemId={previewSt.itemId}
            selectedResultId={previewSt.selectedResultId}
            onResultChange={(resultId) => {
              preview$.selectedResultId.set(resultId);
            }}
            onClose={() => preview$.set(null)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default PreviewPortal;
