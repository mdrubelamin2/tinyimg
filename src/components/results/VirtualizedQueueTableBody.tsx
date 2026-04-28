'use no memo'

import { useValue } from '@legendapp/state/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { debounce } from 'es-toolkit'
import {
  type RefObject,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { getImageStore } from '@/store/image-store'
import { imageStore$ } from '@/store/queue-store'
import { prioritizeThumbnails } from '@/thumbnails/thumbnail-generator'

import { QUEUE_OVERSCAN, QUEUE_ROW_HEIGHT_PX } from './constants'
import { QueueTableHeaderRow } from './QueueTableHeaderRow'
import { QueueTableRow } from './QueueTableRow'
import { ResultRowCells } from './ResultRowCells'
import { StickyTableHead } from './StickyTableHead'

export interface VirtualizedQueueTableBodyProps {
  scrollParent: RefObject<HTMLDivElement | null>
}

export function VirtualizedQueueTableBody({ scrollParent }: VirtualizedQueueTableBodyProps) {
  const itemIds = useValue(() => imageStore$.itemOrder.get())
  const deferredItemIds = useDeferredValue(itemIds)
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

  const rowVirtualizer = useVirtualizer({
    count: deferredItemIds.length,
    estimateSize: () => QUEUE_ROW_HEIGHT_PX,
    getItemKey,
    getScrollElement: () => scrollParent.current,
    overscan: QUEUE_OVERSCAN,
    scrollMargin: headerHeight,
    useFlushSync: false,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  useEffect(() => {
    const firstItem = virtualItems[0]
    const lastItem = virtualItems.at(-1)
    if (!firstItem || !lastItem) return
    const start = firstItem.index
    const end = lastItem.index

    const visibleIds = deferredItemIds.slice(start, end + 1)
    const debouncedUpdate = debounce((ids: string[]) => {
      startTransition(() => {
        prioritizeThumbnails(ids)
        getImageStore().setVisibleItems(ids)
      })
    }, 300)
    debouncedUpdate(visibleIds)

    return () => debouncedUpdate.cancel()
  }, [virtualItems, deferredItemIds])

  return (
    <div
      className='relative h-full w-full'
      style={{ height: `${totalSize}px` }}
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
              ref={rowVirtualizer.measureElement}
            >
              <ResultRowCells id={rowId} />
            </QueueTableRow>
          )
        })}
      </div>
    </div>
  )
}
