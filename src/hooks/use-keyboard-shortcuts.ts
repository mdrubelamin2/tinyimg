/**
 * useKeyboardShortcuts: global keyboard shortcuts for power users.
 */

import { useEffect, useEffectEvent } from 'react'

interface ShortcutHandlers {
  onDelete?: (() => void) | undefined
  onDownload?: (() => void) | undefined
  onEscape?: (() => void) | undefined
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      handlers.onDelete?.()
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handlers.onDownload?.()
    }

    if (e.key === 'Escape') {
      handlers.onEscape?.()
    }
  })

  useEffect(() => {
    const wrapped = (e: KeyboardEvent) => onKeyDown(e)
    globalThis.addEventListener('keydown', wrapped)
    return () => globalThis.removeEventListener('keydown', wrapped)
  }, [])
}
