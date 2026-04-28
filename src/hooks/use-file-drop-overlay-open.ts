import { useSyncExternalStore } from 'react'

import { getFileDropOverlayOpen, subscribeFileDropOverlay } from '@/bootstrap/file-drop-overlay'

export function useFileDropOverlayOpen(): boolean {
  return useSyncExternalStore(
    subscribeFileDropOverlay,
    getFileDropOverlayOpen,
    getFileDropOverlayOpen,
  )
}
