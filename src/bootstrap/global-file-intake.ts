/**
 * Global drag / paste → image queue. Registered once from main (not React effects).
 */

import { bumpFileDragDepth, resetFileDragDepth } from '@/bootstrap/file-drop-overlay';
import { getImageStore } from '@/store/image-store';
import { useSettingsStore } from '@/store/settings-store';

function hasFilePayload(e: DragEvent): boolean {
  return Boolean(e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files'));
}

function handleFilesAdded(files: File[] | DataTransferItem[]): void {
  void getImageStore().addFiles(files, useSettingsStore.getState().options);
}

export function registerGlobalFileIntake(): () => void {
  const onDocumentDragEnter = (e: DragEvent) => {
    if (!hasFilePayload(e)) return;
    e.preventDefault();
    bumpFileDragDepth(1);
  };

  const onDocumentDragLeave = (e: DragEvent) => {
    if (!hasFilePayload(e)) return;
    bumpFileDragDepth(-1);
  };

  const onWindowDragOver = (e: DragEvent) => {
    if (!hasFilePayload(e)) return;
    e.preventDefault();
  };

  const onWindowDropCapture = () => {
    resetFileDragDepth();
  };

  const onWindowDropBubble = (e: DragEvent) => {
    if (!hasFilePayload(e)) return;
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt) return;
    const items = dt.items;
    if (items && items.length > 0) {
      handleFilesAdded(Array.from(items));
    } else if (dt.files?.length) {
      handleFilesAdded(Array.from(dt.files));
    }
  };

  const onDragEnd = () => {
    resetFileDragDepth();
  };

  const onPaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.files;
    if (!items || items.length === 0) return;
    const files = Array.from(items).filter((file) => file.type.startsWith('image/'));
    if (files.length > 0) {
      e.preventDefault();
      handleFilesAdded(files);
    }
  };

  document.addEventListener('dragenter', onDocumentDragEnter);
  document.addEventListener('dragleave', onDocumentDragLeave);
  window.addEventListener('dragover', onWindowDragOver);
  window.addEventListener('drop', onWindowDropCapture, true);
  window.addEventListener('drop', onWindowDropBubble, false);
  window.addEventListener('dragend', onDragEnd);
  window.addEventListener('paste', onPaste);

  return () => {
    document.removeEventListener('dragenter', onDocumentDragEnter);
    document.removeEventListener('dragleave', onDocumentDragLeave);
    window.removeEventListener('dragover', onWindowDragOver);
    window.removeEventListener('drop', onWindowDropCapture, true);
    window.removeEventListener('drop', onWindowDropBubble, false);
    window.removeEventListener('dragend', onDragEnd);
    window.removeEventListener('paste', onPaste);
  };
}
