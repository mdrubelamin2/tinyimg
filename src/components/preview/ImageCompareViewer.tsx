import { CIBeforeAfterViewer } from '@cloudimage/before-after/react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

export interface ImageCompareViewerProps {
  originalUrl: string;
  optimizedUrl: string;
  initialPositionPercent?: number;
  className?: string;
}

const cloudImageLayoutClassName = cn(
  'h-full min-h-0 w-full overflow-hidden',
  '[&_.ci-before-after-container]:!h-full [&_.ci-before-after-container]:!min-h-0',
  '[&_.ci-before-after-wrapper]:!h-full [&_.ci-before-after-wrapper]:!min-h-0 [&_.ci-before-after-wrapper]:!aspect-[unset]',
  '[&_img.ci-before-after-image]:!object-contain [&_img.ci-before-after-image]:object-center',
  '[&_img.ci-before-after-before]:!absolute [&_img.ci-before-after-before]:inset-0',
);

export const ImageCompareViewer = ({ originalUrl, optimizedUrl, initialPositionPercent = 90, className }: ImageCompareViewerProps) => {
  const { resolved: theme } = useTheme();

  return (
    <CIBeforeAfterViewer
      className={cn(cloudImageLayoutClassName, 'rounded-lg border border-border', className)}
      beforeSrc={optimizedUrl}
      afterSrc={originalUrl}
      beforeAlt="Optimized"
      afterAlt="Original"
      mode="drag"
      initialPosition={initialPositionPercent}
      zoom
      theme={theme}
      labels={{
        before: 'Optimized',
        after: 'Original',
      }}
      handleStyle="arrows"
      fullscreenButton={false}
      scrollHint={true}
      animate
    />
  );
};
