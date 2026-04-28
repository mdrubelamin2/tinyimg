/**
 * Global drag / paste → image queue. Registered once from main (not React effects).
 */

import { bumpFileDragDepth, resetFileDragDepth } from '@/bootstrap/file-drop-overlay'
import { getImageStore } from '@/store/image-store'
import { useSettingsStore } from '@/store/settings-store'

export function registerGlobalFileIntake(): () => void {
  const onDocumentDragEnter = (e: DragEvent) => {
    if (!hasFilePayload(e)) return
    e.preventDefault()
    bumpFileDragDepth(1)
  }

  const onDocumentDragLeave = (e: DragEvent) => {
    if (!hasFilePayload(e)) return
    bumpFileDragDepth(-1)
  }

  const onWindowDragOver = (e: DragEvent) => {
    if (!hasFilePayload(e)) return
    e.preventDefault()
  }

  const onWindowDropCapture = () => {
    resetFileDragDepth()
  }

  const onWindowDropBubble = (e: DragEvent) => {
    if (!hasFilePayload(e)) return
    e.preventDefault()
    const dt = e.dataTransfer
    if (!dt) return
    const items = dt.items
    if (items && items.length > 0) {
      handleFilesAdded([...items])
    } else if (dt.files?.length) {
      handleFilesAdded([...dt.files])
    }
  }

  const onDragEnd = () => {
    resetFileDragDepth()
  }

  const onPaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.files
    if (!items || items.length === 0) return
    const files = [...items].filter((file) => file.type.startsWith('image/'))
    if (files.length > 0) {
      e.preventDefault()
      handleFilesAdded(files)
    }
  }

  document.addEventListener('dragenter', onDocumentDragEnter)
  document.addEventListener('dragleave', onDocumentDragLeave)
  globalThis.addEventListener('dragover', onWindowDragOver)
  globalThis.addEventListener('drop', onWindowDropCapture, true)
  globalThis.addEventListener('drop', onWindowDropBubble, false)
  globalThis.addEventListener('dragend', onDragEnd)
  globalThis.addEventListener('paste', onPaste)

  return () => {
    document.removeEventListener('dragenter', onDocumentDragEnter)
    document.removeEventListener('dragleave', onDocumentDragLeave)
    globalThis.removeEventListener('dragover', onWindowDragOver)
    globalThis.removeEventListener('drop', onWindowDropCapture, true)
    globalThis.removeEventListener('drop', onWindowDropBubble, false)
    globalThis.removeEventListener('dragend', onDragEnd)
    globalThis.removeEventListener('paste', onPaste)
  }
}

function handleFilesAdded(files: DataTransferItem[] | File[]): void {
  void getImageStore().addFiles(files, useSettingsStore.getState().options)
}

function hasFilePayload(e: DragEvent): boolean {
  return Boolean(e.dataTransfer?.types && [...e.dataTransfer.types].includes('Files'))
}
