import { CIBeforeAfterViewer } from '@cloudimage/before-after/react'

import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

export interface ImageCompareViewerProps {
  className?: string
  initialPositionPercent?: number
  optimizedUrl: string
  originalUrl: string
}

const cloudImageLayoutClassName = cn(
  'h-full min-h-0 w-full overflow-hidden',
  '[&_.ci-before-after-container]:!h-full [&_.ci-before-after-container]:!min-h-0',
  '[&_.ci-before-after-wrapper]:!h-full [&_.ci-before-after-wrapper]:!min-h-0 [&_.ci-before-after-wrapper]:!aspect-[unset]',
  '[&_img.ci-before-after-image]:!object-contain [&_img.ci-before-after-image]:object-center',
  '[&_img.ci-before-after-before]:!absolute [&_img.ci-before-after-before]:inset-0',
)

export const ImageCompareViewer = ({
  className,
  initialPositionPercent = 90,
  optimizedUrl,
  originalUrl,
}: ImageCompareViewerProps) => {
  const { theme } = useTheme()

  return (
    <CIBeforeAfterViewer
      afterAlt='Original'
      afterSrc={originalUrl}
      animate
      beforeAlt='Optimized'
      beforeSrc={optimizedUrl}
      className={cn(cloudImageLayoutClassName, 'border-border rounded-lg border', className)}
      fullscreenButton={false}
      handleStyle='arrows'
      initialPosition={initialPositionPercent}
      labels={{
        after: 'Original',
        before: 'Optimized',
      }}
      mode='drag'
      scrollHint={true}
      theme={theme}
      zoom
    />
  )
}
