import { useValue } from '@legendapp/state/react'
import { Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { OPEN_IMAGE_AND_ZIP_TYPES, openFilesWithNfsa } from '@/lib/fs-access'
import { cn } from '@/lib/utils'
import { getImageStore, intake$ } from '@/store/image-store'
import { useSettingsStore } from '@/store/settings-store'

export const Dropzone = () => {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const options = useSettingsStore((state) => state.options)
  const addFiles = getImageStore().addFiles

  const intakeBusy = useValue(() => intake$.active.get())
  const dropDisabled = intakeBusy

  const openNativeFilePicker = () => {
    fileInputRef.current?.click()
  }

  const openFileDialog = async () => {
    if (globalThis.window !== undefined && globalThis.matchMedia('(pointer: coarse)').matches) {
      openNativeFilePicker()
      return
    }

    try {
      const handles = await openFilesWithNfsa({
        multiple: true,
        types: OPEN_IMAGE_AND_ZIP_TYPES,
      })
      if (handles.length === 0) {
        openNativeFilePicker()
        return
      }
      const files = await Promise.all(handles.map((h) => h.getFile()))
      if (files.length === 0) {
        openNativeFilePicker()
        return
      }
      addFiles(files, options)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (error instanceof Error && error.name === 'AbortError') return
      openNativeFilePicker()
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const items = e.dataTransfer.items ?? e.dataTransfer.files
    const itemsArray = [...items]
    addFiles(itemsArray, options)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = [...e.target.files]
      addFiles(filesArray, options)
    }
    e.target.value = ''
  }

  return (
    <div className='animate-slide-up mx-auto w-full space-y-6'>
      <button
        aria-label='Drop files or click to choose images and archives'
        className={cn(
          'group glass relative flex min-h-[250px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed p-6 transition-colors duration-200 md:min-h-[300px] md:p-12',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border/70 hover:border-primary/60 hover:bg-primary/[0.03] shadow-xl',
          dropDisabled && 'pointer-events-none cursor-wait opacity-80',
        )}
        disabled={dropDisabled}
        onClick={openFileDialog}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={onDrop}
        type='button'
      >
        <div className='pointer-events-none relative flex flex-col items-center space-y-6 text-center'>
          <div className='bg-primary/5 text-primary rounded-2xl p-5 shadow-sm transition-transform duration-200 group-hover:scale-105 md:p-6'>
            {dropDisabled ? (
              <Loader2
                className='animate-spin md:h-11 md:w-11'
                size={36}
                strokeWidth={1.5}
              />
            ) : (
              <Upload
                className='md:h-11 md:w-11'
                size={36}
                strokeWidth={1.5}
              />
            )}
          </div>
          <h3 className='text-foreground text-2xl font-bold tracking-tight md:text-3xl'>
            {dropDisabled ? 'Adding to queue…' : 'Drop anywhere on the page or paste (Ctrl+V)'}
          </h3>
          <p className='text-muted-foreground max-w-md text-sm leading-relaxed font-medium'>
            SVG, PNG, JPG, WebP, AVIF, GIF, BMP, TIFF, HEIC (Safari), ZIPs. Folders: drag from your
            desktop.
            <br />
            <span className='text-muted-foreground/80'>Highly private.</span>{' '}
            <span className='text-primary font-bold'>Images max 25MB · ZIP max 2GB.</span>
          </p>
          <div className='bg-primary/5 border-primary/10 text-primary inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-bold tracking-widest uppercase'>
            <span
              className={cn(
                'bg-primary h-1.5 w-1.5 rounded-full',
                !dropDisabled && 'animate-pulse-subtle',
              )}
            />
            {dropDisabled ? 'Working' : 'Click to browse'}
          </div>
        </div>

        <input
          accept='.svg,.png,.webp,.avif,.jpg,.jpeg,.gif,.bmp,.tif,.tiff,.heic,.heif,.zip'
          aria-hidden
          className='sr-only'
          multiple
          onChange={handleFileInputChange}
          ref={fileInputRef}
          type='file'
        />
      </button>
    </div>
  )
}
