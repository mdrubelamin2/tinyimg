import { useValue } from '@legendapp/state/react'
import {
  elementScroll,
  type ReactVirtualizerOptions,
  useVirtualizer,
} from '@tanstack/react-virtual'
import { debounce, isEqual } from 'es-toolkit'
import {
  type RefObject,
  startTransition,
  useCallback,
  useDeferredValue,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { easeInOutQuint } from '@/lib/utils'
import { getImageStore } from '@/store/image-store'
import { imageStore$ } from '@/store/queue-store'
import { prioritizeThumbnails } from '@/thumbnails/thumbnail-generator'

import { QUEUE_OVERSCAN, QUEUE_ROW_HEIGHT_PX } from './constants'
import { QueueTableHeaderRow } from './QueueTableHeaderRow'
import QueueTableRow from './QueueTableRow'
import ResultRowCells from './ResultRowCells'
import { StickyTableHead } from './StickyTableHead'

interface VirtualizedQueueTableBodyProps {
  scrollParent: RefObject<HTMLDivElement | null>
}

export function VirtualizedQueueTableBody({ scrollParent }: VirtualizedQueueTableBodyProps) {
  const itemIds = useValue(() => imageStore$.itemOrder.get())
  const deferredItemIds = useDeferredValue(itemIds)
  const scrollingRef = useRef<number>(0)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderHeight(entry.target.getBoundingClientRect().height)
      }
    })

    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  const getItemKey = useCallback(
    (index: number) => deferredItemIds[index] ?? index,
    [deferredItemIds],
  )

  const debouncedUpdateRef = useRef(
    debounce((ids: string[]) => {
      startTransition(() => {
        getImageStore().setVisibleItems(ids)
        prioritizeThumbnails(ids)
      })
    }, 300),
  )

  const debouncedUpdate = useCallback((ids: string[]) => {
    return debouncedUpdateRef.current(ids)
  }, [])

  const scrollToFn: ReactVirtualizerOptions<HTMLDivElement, Element>['scrollToFn'] = useCallback(
    (offset, canSmooth, instance) => {
      const duration = 1000
      const start = scrollParent.current?.scrollTop || 0
      const startTime = Date.now()
      scrollingRef.current = startTime

      const run = () => {
        if (scrollingRef.current !== startTime) return
        const now = Date.now()
        const elapsed = now - startTime
        const progress = easeInOutQuint(Math.min(elapsed / duration, 1))
        const interpolated = start + (offset - start) * progress

        if (elapsed < duration) {
          elementScroll(interpolated, canSmooth, instance)
          requestAnimationFrame(run)
        } else {
          elementScroll(interpolated, canSmooth, instance)
        }
      }

      requestAnimationFrame(run)
    },
    [scrollParent],
  )

  const { getTotalSize, getVirtualItems, measureElement } = useVirtualizer({
    count: deferredItemIds.length,
    estimateSize: () => QUEUE_ROW_HEIGHT_PX,
    getItemKey,
    getScrollElement: () => scrollParent.current,
    onChange: (instance) => {
      const virtualItems = instance.getVirtualItems()
      const firstItem = virtualItems.at(0)
      const lastItem = virtualItems.at(-1)
      if (!firstItem || !lastItem) return

      const start = firstItem.index
      const end = lastItem.index
      const visibleIds = deferredItemIds.slice(start, end + 1)
      if (!isEqual(imageStore$.visibleItemIds.peek(), visibleIds)) {
        debouncedUpdate(visibleIds)
      }
    },
    overscan: QUEUE_OVERSCAN,
    scrollMargin: headerHeight,
    scrollToFn,
    useFlushSync: false,
  })

  const virtualItems = getVirtualItems()
  const totalSize = getTotalSize()

  return (
    <div
      className='relative h-full w-full'
      style={{ height: totalSize }}
    >
      <StickyTableHead ref={headerRef}>
        <QueueTableHeaderRow />
      </StickyTableHead>
      <div
        className='absolute top-0 left-0 w-full will-change-transform'
        style={{
          transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
        }}
      >
        {virtualItems.map((virtualRow) => {
          const rowId = deferredItemIds[virtualRow.index]
          if (!rowId) return null

          return (
            <QueueTableRow
              id={rowId}
              index={virtualRow.index}
              key={virtualRow.key}
              ref={measureElement}
              style={{
                height: virtualRow.size,
              }}
            >
              <ResultRowCells id={rowId} />
            </QueueTableRow>
          )
        })}
      </div>
    </div>
  )
}
