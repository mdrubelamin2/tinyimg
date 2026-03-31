/**
 * useKeyboardShortcuts: global keyboard shortcuts using react-hotkeys-hook.
 */

import { useHotkeys } from 'react-hotkeys-hook';

interface ShortcutHandlers {
  onDelete?: (() => void) | undefined;
  onDownload?: (() => void) | undefined;
  onEscape?: (() => void) | undefined;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  // Delete/Backspace - delete selected items
  useHotkeys(
    'delete,backspace',
    (e) => {
      e.preventDefault();
      handlers.onDelete?.();
    },
    {
      enabled: !!handlers.onDelete,
      enableOnFormTags: false, // Don't fire when typing in inputs
    }
  );

  // Cmd+S / Ctrl+S - download all
  useHotkeys(
    'mod+s',
    (e) => {
      e.preventDefault();
      handlers.onDownload?.();
    },
    {
      enabled: !!handlers.onDownload,
      enableOnFormTags: false,
    }
  );

  // Escape - close preview/modal
  useHotkeys(
    'escape',
    () => {
      handlers.onEscape?.();
    },
    {
      enabled: !!handlers.onEscape,
      enableOnFormTags: true, // Allow escape even in inputs
    }
  );
}
