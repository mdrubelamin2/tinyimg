import { useState, useTransition } from 'react';
import {
  Settings,
  RefreshCcw,
  CheckCircle,
  FileType,
  Link2,
  Link2Off,
  Plus,
  Trash2,
} from 'lucide-react';
import { getImageStore } from '@/store/image-store';
import { useSettingsStore } from '@/store/settings-store';
import type { GlobalOptions, OutputSizePreset } from '@/constants';
import {
  DEFAULT_GLOBAL_OPTIONS,
  SVG_INTERNAL_FORMATS,
  OUTPUT_SLOT_EXPLOSION_WARN_THRESHOLD,
  RESIZE_MAX_EDGE_MAX,
  newOutputSizePresetId,
} from '@/constants';
import { globalOptionsEqual } from '@/lib/global-options-equal';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export function ConfigPanel() {
  const options = useSettingsStore(state => state.options);
  const setOptions = useSettingsStore(state => state.setOptions);
  const applyGlobalOptions = getImageStore().applyGlobalOptions;

  const [isPending, startTransition] = useTransition();

  const [draft, setDraft] = useState<GlobalOptions>({ ...options });

  const hasChanges = !globalOptionsEqual(draft, options);

  const updateDraft = <K extends keyof GlobalOptions>(key: K, value: GlobalOptions[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const {
    formats,
    useOriginalFormats,
    includeOriginalInCustom,
    useOriginalSizes,
    includeNativeSizeInCustom,
    customSizePresets,
    svgInternalFormat,
  } = draft;

  const formatCountEstimate = useOriginalFormats
    ? 1
    : Math.max(1, formats.length + (includeOriginalInCustom ? 1 : 0));

  const validPresetRows = customSizePresets.filter((p) => {
    if (p.maintainAspect) {
      if (p.width > 0) return p.width <= RESIZE_MAX_EDGE_MAX;
      if (p.height > 0) return p.height <= RESIZE_MAX_EDGE_MAX;
      return false;
    }
    return (
      p.width >= 1 &&
      p.width <= RESIZE_MAX_EDGE_MAX &&
      p.height >= 1 &&
      p.height <= RESIZE_MAX_EDGE_MAX
    );
  });

  const sizeCountEstimate = useOriginalSizes
    ? 1
    : Math.max(
        1,
        validPresetRows.length + (includeNativeSizeInCustom ? 1 : 0)
      );

  const slotProductEstimate = formatCountEstimate * sizeCountEstimate;
  const showSlotExplosion =
    !useOriginalSizes && slotProductEstimate >= OUTPUT_SLOT_EXPLOSION_WARN_THRESHOLD;

  const updatePreset = (id: string, patch: Partial<OutputSizePreset>) => {
    updateDraft(
      'customSizePresets',
      customSizePresets.map((p) => (p.id === id ? { ...p, ...patch } : p))
    );
  };

  const removePreset = (id: string) => {
    const next = customSizePresets.filter((p) => p.id !== id);
    updateDraft('customSizePresets', next.length > 0 ? next : [
      { id: newOutputSizePresetId(), width: 800, height: 0, maintainAspect: true },
    ]);
  };

  const addPreset = (width?: number, height?: number, maintainAspect = true) => {
    updateDraft('customSizePresets', [
      ...customSizePresets,
      {
        id: newOutputSizePresetId(),
        width: width ?? 800,
        height: height ?? 0,
        maintainAspect,
      },
    ]);
  };

  const toggleFormat = (f: string) => {
    const newFormats = formats.includes(f)
      ? formats.filter(x => x !== f)
      : [...formats, f];
    if (newFormats.length === 0 && !includeOriginalInCustom) return;
    updateDraft('formats', newFormats);
  };

  const availableFormats = SVG_INTERNAL_FORMATS;
  const allFormatsSelected = formats.length === availableFormats.length;
  const someFormatsSelected = formats.length > 0;

  const handleSelectAll = () => {
    updateDraft('formats',
      allFormatsSelected
        ? includeOriginalInCustom ? [] : [availableFormats[0]!]
        : [...availableFormats]
    );
  };

  const handleApplyToAll = () => {
    setOptions(draft);
    startTransition(() => {
      applyGlobalOptions(draft, true);
    });
  };

  const handleResetToDefaults = () => {
    setDraft({ ...DEFAULT_GLOBAL_OPTIONS });
  };

  return (
    <div className="w-full lg:w-80 lg:min-h-[calc(100vh-160px)] glass p-6 rounded-3xl flex flex-col lg:sticky lg:top-32 shadow-2xl shadow-primary/5 animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-md shadow-primary/10">
          <Settings size={20} />
        </div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">Configuration</h2>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto pr-2">
        {/* Output Formats Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Output Formats</label>
            <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  if (!useOriginalFormats) {
                    setDraft({
                      ...draft,
                      useOriginalFormats: true,
                      formats: [],
                    });
                  }
                }}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 cursor-pointer",
                  useOriginalFormats
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={useOriginalFormats}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => {
                  if (useOriginalFormats) {
                    setDraft({
                      ...draft,
                      useOriginalFormats: false,
                      formats: formats.length === 0 ? ['webp'] : formats,
                    });
                  }
                }}
                className={cn(
                  "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 cursor-pointer",
                  !useOriginalFormats
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={!useOriginalFormats}
              >
                Custom
              </button>
            </div>
          </div>

          {!useOriginalFormats && (
            <div className="flex flex-wrap items-center gap-4 min-h-[44px]">
              <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px] group">
                <Checkbox
                  checked={allFormatsSelected ? true : someFormatsSelected ? 'indeterminate' : false}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all output formats"
                />
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                  Select all
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px] group">
                <Checkbox
                  checked={includeOriginalInCustom}
                  onCheckedChange={() => updateDraft('includeOriginalInCustom', !includeOriginalInCustom)}
                  aria-label="Include original format in output"
                />
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                  Include Original
                </span>
              </label>
            </div>
          )}

          <div className={cn("grid grid-cols-2 gap-2 transition-opacity duration-200", useOriginalFormats ? "opacity-30 pointer-events-none grayscale" : "opacity-100")}>
            {availableFormats.map((f) => (
              <button
                key={f}
                type="button"
                disabled={useOriginalFormats}
                onClick={() => toggleFormat(f)}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors duration-200 min-h-[44px]",
                  formats.includes(f)
                    ? "border-primary bg-primary/5 text-primary font-bold shadow-md shadow-primary/10 cursor-pointer"
                    : "border-border bg-surface/60 text-muted-foreground hover:border-primary/30 hover:bg-surface hover:shadow-sm cursor-pointer disabled:cursor-not-allowed"
                )}
              >
                <span className="uppercase text-[11px] tracking-tight">{f}</span>
                {formats.includes(f) && <CheckCircle size={12} strokeWidth={3} className="text-primary" />}
              </button>
            ))}
          </div>
        </div>

        {/* Output sizes */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
              Output sizes
            </label>
            <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  if (!useOriginalSizes) {
                    setDraft({ ...draft, useOriginalSizes: true });
                  }
                }}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 cursor-pointer',
                  useOriginalSizes
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-pressed={useOriginalSizes}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => {
                  if (useOriginalSizes) {
                    setDraft({ ...draft, useOriginalSizes: false });
                  }
                }}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all duration-200 cursor-pointer',
                  !useOriginalSizes
                    ? 'bg-surface text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-pressed={!useOriginalSizes}
              >
                Custom
              </button>
            </div>
          </div>

          {!useOriginalSizes && (
            <>
              <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px] group m-0">
                <Checkbox
                  checked={includeNativeSizeInCustom}
                  onCheckedChange={() =>
                    updateDraft('includeNativeSizeInCustom', !includeNativeSizeInCustom)
                  }
                  aria-label="Include native pixel size in custom sizes"
                />
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                  Include Original
                </span>
              </label>

              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Vector SVG output ignores custom sizes (one optimized SVG). Raster formats from SVGs use
                your size list.
              </p>

              {showSlotExplosion && (
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-relaxed rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  Up to ~{slotProductEstimate} files per image ({formatCountEstimate} formats ×{' '}
                  {sizeCountEstimate} sizes). Large batches use more memory and time.
                </p>
              )}

              <div className="space-y-2">
                {customSizePresets.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-end gap-2 rounded-xl border border-border bg-surface/40 p-3"
                  >
                    <div className="min-w-[4.5rem] flex-1">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                        Width
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={RESIZE_MAX_EDGE_MAX}
                        value={row.width || ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            updatePreset(row.id, { width: 0 });
                            return;
                          }
                          const v = parseInt(raw, 10);
                          const width = Number.isFinite(v)
                            ? Math.min(RESIZE_MAX_EDGE_MAX, Math.max(0, v))
                            : 0;
                          if (row.maintainAspect) {
                            updatePreset(row.id, { width, height: width > 0 ? 0 : row.height });
                          } else {
                            updatePreset(row.id, { width });
                          }
                        }}
                        className="w-full h-9 rounded-lg border border-border bg-background px-2 py-2 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        aria-label="Output width in pixels"
                        placeholder={row.maintainAspect ? "Auto" : "Input width"}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                        Link
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !row.maintainAspect;
                          if (next) {
                            updatePreset(row.id, { maintainAspect: true, height: 0 });
                          } else {
                            updatePreset(row.id, { maintainAspect: false });
                          }
                        }}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
                          row.maintainAspect
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                        )}
                        title={
                          row.maintainAspect
                            ? 'Aspect ratio locked: enter width or height (the other clears)'
                            : 'Independent width and height'
                        }
                        aria-pressed={row.maintainAspect}
                        aria-label="Toggle aspect ratio lock"
                      >
                        {row.maintainAspect ? <Link2 size={16} /> : <Link2Off size={16} />}
                      </button>
                    </div>
                    <div className="min-w-[4.5rem] flex-1">
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                        Height
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={RESIZE_MAX_EDGE_MAX}
                        value={row.height || ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            updatePreset(row.id, { height: 0 });
                            return;
                          }
                          const v = parseInt(raw, 10);
                          const height = Number.isFinite(v)
                            ? Math.min(RESIZE_MAX_EDGE_MAX, Math.max(0, v))
                            : 0;
                          if (row.maintainAspect) {
                            updatePreset(row.id, { height, width: height > 0 ? 0 : row.width });
                          } else {
                            updatePreset(row.id, { height });
                          }
                        }}
                        className="w-full h-9 rounded-lg border border-border bg-background px-2 py-2 text-xs font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        aria-label="Output height in pixels"
                        placeholder={row.maintainAspect ? "Auto" : "Input height"}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePreset(row.id)}
                      className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Remove size preset"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-[10px] uppercase tracking-wider"
                  onClick={() => addPreset()}
                >
                  <Plus size={14} className="mr-1" /> Add size
                </Button>
                {[640, 768, 1024, 1920].map((w) => (
                  <Button
                    key={w}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="text-[10px] font-bold"
                    onClick={() => addPreset(w, 0, true)}
                  >
                    {w}w
                  </Button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* SVG Internal Data Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileType size={14} className="text-muted-foreground" />
            <label htmlFor="svg-internal-format" className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
              SVG Internal Data
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
            Controls the internal raster format used when processing SVGs. The SVG is rendered to this format before optimization and export.
          </p>
          <Select
            value={svgInternalFormat}
            onValueChange={(value) => updateDraft('svgInternalFormat', value as GlobalOptions['svgInternalFormat'])}
          >
            <SelectTrigger id="svg-internal-format" aria-label="SVG internal raster format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableFormats.map((f) => (
                <SelectItem key={f} value={f}>
                  {f.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pt-8 border-t border-border mt-8 flex flex-col gap-y-3">
        <Button
          variant="default"
          onClick={handleApplyToAll}
          disabled={!hasChanges || isPending}
          className="w-full text-[10px] uppercase tracking-widest cursor-pointer disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isPending ? (
            <RefreshCcw size={14} className="mr-2 animate-spin" />
          ) : (
            <CheckCircle size={14} strokeWidth={3} className="mr-2" />
          )}
          {isPending ? 'Applying...' : 'Apply to All'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleResetToDefaults}
          className="w-full text-[10px] uppercase tracking-widest cursor-pointer transition-colors duration-200"
        >
          <RefreshCcw size={14} strokeWidth={3} /> Reset to Default
        </Button>
      </div>
    </div>
  );
}
