import {
  CheckCircle,
  FileType,
  Link2,
  Link2Off,
  Plus,
  RefreshCcw,
  Settings,
  Trash2,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useState } from 'react'

import type { GlobalOptions, LosslessEncoding, OutputSizePreset } from '@/constants'

import {
  DEFAULT_GLOBAL_OPTIONS,
  newOutputSizePresetId,
  OUTPUT_SLOT_EXPLOSION_WARN_THRESHOLD,
  RESIZE_MAX_EDGE_MAX,
  SVG_INTERNAL_FORMATS,
} from '@/constants'
import { globalOptionsEqual } from '@/lib/global-options-equal'
import { cn } from '@/lib/utils'
import { getImageStore } from '@/store/image-store'
import { useSettingsStore } from '@/store/settings-store'

import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export function ConfigPanel() {
  const options = useSettingsStore((state) => state.options)
  const setOptions = useSettingsStore((state) => state.setOptions)
  const applyGlobalOptions = getImageStore().applyGlobalOptions

  const [draft, setDraft] = useState<GlobalOptions>({ ...options })

  const hasChanges = !globalOptionsEqual(draft, options)

  const updateDraft = <K extends keyof GlobalOptions>(key: K, value: GlobalOptions[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const {
    customSizePresets,
    formats,
    includeNativeSizeInCustom,
    includeOriginalInCustom,
    losslessEncoding,
    svgInternalFormat,
    useOriginalFormats,
    useOriginalSizes,
  } = draft

  const formatCountEstimate = useOriginalFormats
    ? 1
    : Math.max(1, formats.length + (includeOriginalInCustom ? 1 : 0))

  const validPresetRows = customSizePresets.filter((p) => {
    if (p.maintainAspect) {
      if (p.width > 0) return p.width <= RESIZE_MAX_EDGE_MAX
      if (p.height > 0) return p.height <= RESIZE_MAX_EDGE_MAX
      return false
    }
    return (
      p.width >= 1 &&
      p.width <= RESIZE_MAX_EDGE_MAX &&
      p.height >= 1 &&
      p.height <= RESIZE_MAX_EDGE_MAX
    )
  })

  const sizeCountEstimate = useOriginalSizes
    ? 1
    : Math.max(1, validPresetRows.length + (includeNativeSizeInCustom ? 1 : 0))

  const slotProductEstimate = formatCountEstimate * sizeCountEstimate
  const showSlotExplosion =
    !useOriginalSizes && slotProductEstimate >= OUTPUT_SLOT_EXPLOSION_WARN_THRESHOLD

  const updatePreset = (id: string, patch: Partial<OutputSizePreset>) => {
    updateDraft(
      'customSizePresets',
      customSizePresets.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    )
  }

  const removePreset = (id: string) => {
    const next = customSizePresets.filter((p) => p.id !== id)
    updateDraft(
      'customSizePresets',
      next.length > 0
        ? next
        : [
            {
              height: 0,
              id: newOutputSizePresetId(),
              maintainAspect: true,
              width: 800,
            },
          ],
    )
  }

  const addPreset = (width?: number, height?: number, maintainAspect = true) => {
    updateDraft('customSizePresets', [
      ...customSizePresets,
      {
        height: height ?? 0,
        id: newOutputSizePresetId(),
        maintainAspect,
        width: width ?? 800,
      },
    ])
  }

  const toggleFormat = (f: string) => {
    const newFormats = formats.includes(f) ? formats.filter((x) => x !== f) : [...formats, f]
    if (newFormats.length === 0 && !includeOriginalInCustom) return
    updateDraft('formats', newFormats)
  }

  const availableFormats = SVG_INTERNAL_FORMATS
  const allFormatsSelected = formats.length === availableFormats.length
  const someFormatsSelected = formats.length > 0

  const handleSelectAll = () => {
    updateDraft(
      'formats',
      allFormatsSelected
        ? includeOriginalInCustom
          ? []
          : [availableFormats[0]!]
        : [...availableFormats],
    )
    if (!allFormatsSelected) {
      updateDraft('includeOriginalInCustom', true)
    }
  }

  const handleApplyToAll = () => {
    setOptions(draft)
    applyGlobalOptions(draft)
  }

  const handleResetToDefaults = () => {
    setDraft({ ...DEFAULT_GLOBAL_OPTIONS })
  }

  return (
    <div
      className='glass shadow-primary/5 animate-slide-up flex w-full flex-col rounded-3xl p-6 shadow-2xl lg:sticky lg:top-32 lg:min-h-[calc(100vh-160px)] lg:w-80'
      style={{ animationDelay: '0.2s' }}
    >
      <div className='mb-8 flex items-center gap-3'>
        <div className='from-primary/10 to-primary/5 text-primary shadow-primary/10 rounded-xl bg-gradient-to-br p-2.5 shadow-md'>
          <Settings size={20} />
        </div>
        <h2 className='text-foreground text-xl font-bold tracking-tight'>Configuration</h2>
      </div>

      <div className='flex-1 space-y-8 overflow-y-auto pr-2'>
        {/* Output Formats Section */}
        <div className='space-y-4'>
          <div className='mb-3 flex items-center justify-between'>
            <span className='text-muted-foreground text-[10px] font-black tracking-[0.2em] uppercase'>
              Output Formats
            </span>
            <div className='border-border bg-muted inline-flex rounded-lg border p-0.5 shadow-sm'>
              <button
                aria-pressed={useOriginalFormats}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200',
                  useOriginalFormats
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  if (!useOriginalFormats) {
                    setDraft({
                      ...draft,
                      formats: [],
                      useOriginalFormats: true,
                    })
                  }
                }}
                type='button'
              >
                Original
              </button>
              <button
                aria-pressed={!useOriginalFormats}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200',
                  useOriginalFormats
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'bg-surface text-foreground shadow-sm',
                )}
                onClick={() => {
                  if (useOriginalFormats) {
                    setDraft({
                      ...draft,
                      formats: formats.length === 0 ? ['webp'] : formats,
                      useOriginalFormats: false,
                    })
                  }
                }}
                type='button'
              >
                Custom
              </button>
            </div>
          </div>

          {!useOriginalFormats && (
            <div className='flex min-h-[40px] flex-wrap items-center gap-4'>
              <div className='group flex min-h-[44px] cursor-pointer items-center gap-2 select-none'>
                <Checkbox
                  aria-label='Select all output formats'
                  checked={
                    allFormatsSelected ? true : someFormatsSelected ? 'indeterminate' : false
                  }
                  id='select-all-formats'
                  onCheckedChange={handleSelectAll}
                />
                <label
                  className='text-foreground group-hover:text-primary cursor-pointer text-[10px] font-bold tracking-wider uppercase transition-colors'
                  htmlFor='select-all-formats'
                >
                  Select all
                </label>
              </div>
              <div className='group flex min-h-[44px] cursor-pointer items-center gap-2 select-none'>
                <Checkbox
                  aria-label='Include original format in output'
                  checked={includeOriginalInCustom}
                  id='include-original-format'
                  onCheckedChange={() =>
                    updateDraft('includeOriginalInCustom', !includeOriginalInCustom)
                  }
                />
                <label
                  className='text-foreground group-hover:text-primary cursor-pointer text-[10px] font-bold tracking-wider uppercase transition-colors'
                  htmlFor='include-original-format'
                >
                  Include Original
                </label>
              </div>
            </div>
          )}

          <div
            className={cn(
              'grid grid-cols-2 gap-2 transition-opacity duration-200',
              useOriginalFormats ? 'pointer-events-none opacity-30 grayscale' : 'opacity-100',
            )}
          >
            {availableFormats.map((f) => (
              <button
                className={cn(
                  'flex min-h-[44px] items-center justify-between rounded-xl border px-3 py-2.5 transition-colors duration-200',
                  formats.includes(f)
                    ? 'border-primary bg-primary/5 text-primary shadow-primary/10 cursor-pointer font-bold shadow-md'
                    : 'border-border bg-surface/60 text-muted-foreground hover:border-primary/30 hover:bg-surface cursor-pointer hover:shadow-sm disabled:cursor-not-allowed',
                )}
                disabled={useOriginalFormats}
                key={f}
                onClick={() => toggleFormat(f)}
                type='button'
              >
                <span className='text-[11px] tracking-tight uppercase'>{f}</span>
                {formats.includes(f) && (
                  <CheckCircle
                    className='text-primary'
                    size={12}
                    strokeWidth={3}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Output sizes */}
        <div className=''>
          <div className='mb-3 flex items-center justify-between'>
            <span className='text-muted-foreground text-[10px] font-black tracking-[0.2em] uppercase'>
              Output sizes
            </span>
            <div className='border-border bg-muted inline-flex rounded-lg border p-0.5 shadow-sm'>
              <button
                aria-pressed={useOriginalSizes}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200',
                  useOriginalSizes
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  if (!useOriginalSizes) {
                    setDraft({
                      ...draft,
                      customSizePresets: [
                        {
                          height: 0,
                          id: nanoid(),
                          maintainAspect: true,
                          width: 0,
                        },
                      ],
                      includeNativeSizeInCustom: false,
                      useOriginalSizes: true,
                    })
                  }
                }}
                type='button'
              >
                Original
              </button>
              <button
                aria-pressed={!useOriginalSizes}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all duration-200',
                  useOriginalSizes
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'bg-surface text-foreground shadow-sm',
                )}
                onClick={() => {
                  if (useOriginalSizes) {
                    setDraft({
                      ...draft,
                      customSizePresets: [...DEFAULT_GLOBAL_OPTIONS.customSizePresets],
                      useOriginalSizes: false,
                    })
                  }
                }}
                type='button'
              >
                Custom
              </button>
            </div>
          </div>

          {!useOriginalSizes && (
            <>
              <div className='group m-0 flex min-h-[40px] cursor-pointer items-center gap-2 select-none'>
                <Checkbox
                  aria-label='Include native pixel size in custom sizes'
                  checked={includeNativeSizeInCustom}
                  id='include-native-size'
                  onCheckedChange={() =>
                    updateDraft('includeNativeSizeInCustom', !includeNativeSizeInCustom)
                  }
                />
                <label
                  className='text-foreground group-hover:text-primary cursor-pointer text-[10px] font-bold tracking-wider uppercase transition-colors'
                  htmlFor='include-native-size'
                >
                  Include Original
                </label>
              </div>

              <p className='text-muted-foreground mb-3 text-[10px] leading-relaxed'>
                Vector SVG output ignores custom sizes (one optimized SVG). Raster formats from SVGs
                use your size list.
              </p>

              {showSlotExplosion && (
                <p className='rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed font-bold text-amber-600 dark:text-amber-400'>
                  Up to ~{slotProductEstimate} files per image ({formatCountEstimate} formats ×{' '}
                  {sizeCountEstimate} sizes). Large batches use more memory and time.
                </p>
              )}
            </>
          )}
          <div
            className={cn(
              'mb-3 space-y-2',
              useOriginalSizes ? 'pointer-events-none opacity-30 grayscale' : 'opacity-100',
            )}
          >
            {customSizePresets.map((row) => (
              <div
                className='border-border bg-surface/40 flex items-end gap-2 rounded-xl border p-3'
                key={row.id}
              >
                <div className='min-w-[4.5rem] flex-1'>
                  <span className='text-muted-foreground mb-1 block text-[9px] font-black tracking-wider uppercase'>
                    Width
                  </span>
                  <input
                    aria-label='Output width in pixels'
                    className='border-border bg-background text-foreground focus-visible:ring-primary/40 h-9 w-full rounded-lg border px-2 py-2 text-xs font-bold outline-none focus-visible:ring-2'
                    max={RESIZE_MAX_EDGE_MAX}
                    min={1}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '') {
                        updatePreset(row.id, { width: 0 })
                        return
                      }
                      const v = Number.parseInt(raw, 10)
                      const width = Number.isFinite(v)
                        ? Math.min(RESIZE_MAX_EDGE_MAX, Math.max(0, v))
                        : 0
                      if (row.maintainAspect) {
                        updatePreset(row.id, {
                          height: width > 0 ? 0 : row.height,
                          width,
                        })
                      } else {
                        updatePreset(row.id, { width })
                      }
                    }}
                    placeholder={row.maintainAspect ? 'Auto' : 'Input width'}
                    type='number'
                    value={row.width || ''}
                  />
                </div>
                <div className='flex flex-col items-center'>
                  <span className='text-muted-foreground mb-1 block text-[9px] font-black tracking-wider uppercase'>
                    Link
                  </span>
                  <button
                    aria-label='Toggle aspect ratio lock'
                    aria-pressed={row.maintainAspect}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                      row.maintainAspect
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => {
                      const next = !row.maintainAspect
                      if (next) {
                        updatePreset(row.id, {
                          height: 0,
                          maintainAspect: true,
                        })
                      } else {
                        updatePreset(row.id, { maintainAspect: false })
                      }
                    }}
                    title={
                      row.maintainAspect
                        ? 'Aspect ratio locked: enter width or height (the other clears)'
                        : 'Independent width and height'
                    }
                    type='button'
                  >
                    {row.maintainAspect ? <Link2 size={16} /> : <Link2Off size={16} />}
                  </button>
                </div>
                <div className='min-w-[4.5rem] flex-1'>
                  <span className='text-muted-foreground mb-1 block text-[9px] font-black tracking-wider uppercase'>
                    Height
                  </span>
                  <input
                    aria-label='Output height in pixels'
                    className='border-border bg-background text-foreground focus-visible:ring-primary/40 h-9 w-full rounded-lg border px-2 py-2 text-xs font-bold outline-none focus-visible:ring-2'
                    max={RESIZE_MAX_EDGE_MAX}
                    min={1}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === '') {
                        updatePreset(row.id, { height: 0 })
                        return
                      }
                      const v = Number.parseInt(raw, 10)
                      const height = Number.isFinite(v)
                        ? Math.min(RESIZE_MAX_EDGE_MAX, Math.max(0, v))
                        : 0
                      if (row.maintainAspect) {
                        updatePreset(row.id, {
                          height,
                          width: height > 0 ? 0 : row.width,
                        })
                      } else {
                        updatePreset(row.id, { height })
                      }
                    }}
                    placeholder={row.maintainAspect ? 'Auto' : 'Input height'}
                    type='number'
                    value={row.height || ''}
                  />
                </div>
                <button
                  aria-label='Remove size preset'
                  className='border-border text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors'
                  onClick={() => removePreset(row.id)}
                  type='button'
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {!useOriginalSizes && (
            <div className='flex flex-wrap gap-2'>
              <Button
                className='text-[10px] tracking-wider uppercase'
                onClick={() => addPreset()}
                size='sm'
                type='button'
                variant='secondary'
              >
                <Plus
                  className='mr-1'
                  size={14}
                />{' '}
                Add size
              </Button>
              {[640, 768, 1024, 1920].map((w) => (
                <Button
                  className='text-[10px] font-bold'
                  key={w}
                  onClick={() => addPreset(w, 0, true)}
                  size='sm'
                  type='button'
                  variant='secondary'
                >
                  {w}w
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Lossless encoding (raster outputs) */}
        <div className='space-y-4'>
          <div className='mb-1 flex items-center gap-2'>
            <FileType
              className='text-muted-foreground'
              size={14}
            />
            <label
              className='text-muted-foreground text-[10px] font-black tracking-[0.2em] uppercase'
              htmlFor='lossless-encoding'
            >
              Lossless encoding
            </label>
          </div>
          <p className='text-muted-foreground mb-3 text-[10px] leading-relaxed'>
            Often increases file size but offers zero compression overhead. None (lossy, default) is
            recommended for most use cases.
          </p>
          <Select
            onValueChange={(value) => updateDraft('losslessEncoding', value as LosslessEncoding)}
            value={losslessEncoding}
          >
            <SelectTrigger
              aria-label='Lossless encoding mode'
              id='lossless-encoding'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>None (lossy, default)</SelectItem>
              <SelectItem value='all'>All outputs</SelectItem>
              <SelectItem value='custom_sizes_only'>Custom sizes only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* SVG Internal Data Section */}
        <div className='space-y-4'>
          <div className='mb-1 flex items-center gap-2'>
            <FileType
              className='text-muted-foreground'
              size={14}
            />
            <label
              className='text-muted-foreground text-[10px] font-black tracking-[0.2em] uppercase'
              htmlFor='svg-internal-format'
            >
              SVG Internal Data
            </label>
          </div>
          <p className='text-muted-foreground mb-3 text-[10px] leading-relaxed'>
            Controls the internal raster format used when processing SVGs. The SVG is rendered to
            this format before optimization and export.
          </p>
          <Select
            onValueChange={(value) =>
              updateDraft('svgInternalFormat', value as GlobalOptions['svgInternalFormat'])
            }
            value={svgInternalFormat}
          >
            <SelectTrigger
              aria-label='SVG internal raster format'
              id='svg-internal-format'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableFormats.map((f) => (
                <SelectItem
                  key={f}
                  value={f}
                >
                  {f.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='border-border mt-8 flex flex-col gap-y-3 border-t pt-8'>
        <Button
          className='w-full cursor-pointer text-[10px] tracking-widest uppercase transition-colors duration-200 disabled:cursor-not-allowed'
          disabled={!hasChanges}
          onClick={handleApplyToAll}
          variant='default'
        >
          <CheckCircle
            className='mr-2'
            size={14}
            strokeWidth={3}
          />
          Apply to All
        </Button>
        <Button
          className='w-full cursor-pointer text-[10px] tracking-widest uppercase transition-colors duration-200'
          onClick={handleResetToDefaults}
          variant='secondary'
        >
          <RefreshCcw
            size={14}
            strokeWidth={3}
          />{' '}
          Reset to Default
        </Button>
      </div>
    </div>
  )
}
