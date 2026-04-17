import { useState, useTransition } from 'react';
import { Settings, RefreshCcw, CheckCircle, FileType } from 'lucide-react';
import { getImageStore } from '@/store/image-store';
import { useSettingsStore } from '@/store/settings-store';
import type { GlobalOptions } from '@/constants';
import { DEFAULT_GLOBAL_OPTIONS, SVG_INTERNAL_FORMATS } from '@/constants';
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
    svgInternalFormat,
  } = draft;

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
                  Original
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
                  {f.toUpperCase()} (WASM Optimized)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="pt-8 border-t border-border mt-auto space-y-3">
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
