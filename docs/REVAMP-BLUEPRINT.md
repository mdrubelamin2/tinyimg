# TinyIMG Revamp Blueprint

**Date:** March 26, 2026  
**Status:** Draft — Ready for review  
**Scope:** Full architectural restructure + feature additions  
**Timeline estimate:** 4–5 weeks (phased, each phase independently shippable)

---

## 1. Executive Summary

tinyimg2 is a browser-based, privacy-first image optimizer using WASM codecs. The current draft has a solid codec foundation and unique capabilities (content-aware presets, dual SVG rasterizer), but suffers from 30 TypeScript errors, a God Class orchestrator, half-wired features, dead code, and missing user-facing features that every competitor already ships (quality slider, preview, resize, HEIC, dark mode).

This blueprint restructures the codebase around composition, typed protocols, cancelable workers, a codec plugin system, and a Zustand store — while preserving every gem that makes TinyIMG unique. It is NOT a rewrite from scratch; it's a restructure-and-extend with a migration strategy that never breaks the build.

---

## 2. Current State Forensics

### 2.1 TypeScript Errors (30 total)

| Category | Count | Root Cause |
|---|---|---|
| `abortInFlightForItem` doesn't exist on WorkerPool | 3 | Method planned but never implemented |
| `outputFormatsOverride` / `qualityPercentOverride` not in ImageItem | 4 | Per-item override fields planned but not added to type |
| `qualityPercent` / `resizeMaxEdge` not in TaskOptions | 3 | Worker-side options planned but not typed |
| `isHeicDecodeLikelySupported` not exported from validation.ts | 1 | Function planned but never written |
| `exactOptionalPropertyTypes` spread issues in queue-results.ts | 6 | Object spreads produce optional properties vs required |
| `override` missing on ErrorBoundary methods | 3 | TS 5.9 strict requires `override` for class method overrides |
| JXL type mismatch in SVG pipeline | 2 | SvgInternalFormat includes 'jxl' but encode functions accept only 4 formats |
| Worker pool and test type issues | 8 | Various strict mode violations |

### 2.2 Architectural Problems

1. **God Class** — `QueueProcessor` (278 lines) owns state, worker pool, processing loop, options, reorder, and per-item overrides. Every new feature touches this one file.
2. **Callback state** — `new QueueProcessor(setItems)` in `useMemo`. Every worker message creates a full `[...this.queue]` copy and calls `setState`. No granular updates.
3. **No cancellation** — Workers run until completion or 120s timeout. `abortInFlightForItem` is called but doesn't exist.
4. **Untyped worker protocol** — `self.postMessage({...})` with no discriminated union. Receiver casts `data as unknown as WorkerResponse`.
5. **Dead options** — `qualityPercent` and `resizeMaxEdge` are sent to workers but completely ignored. Presets are hardcoded constants.
6. **Dead code** — `App.css` (184 lines of Vite scaffold), `canvg` and `calc-s2-rust` in deps but never imported.

### 2.3 Gems to Preserve

| Gem | File | Lines |
|---|---|---|
| Zero magic values constants | `constants.ts` | 184 |
| Content-aware classify (color count + entropy) | `workers/classify.ts` | 62 |
| Dual SVG rasterizer (browser + resvg) with DPR | `workers/svg-pipeline.ts`, `svg-browser-raster.ts` | ~580 |
| Lossless-vs-lossy size guard | `workers/raster-encode.ts` | ~30 |
| Photo/graphic encoder presets | `workers/raster-encode.ts` | ~60 |
| Magic byte validation | `lib/validation.ts` | 83 |
| ZIP intake with `__MACOSX` filtering | `lib/queue/queue-intake.ts` | 179 |
| Quality research & acceptance criteria docs | `docs/` | ~235 |
| E2E + quality gate CI pipeline | `scripts/`, `tests/` | ~300 |

---

## 3. New Architecture

### 3.1 Design Principles

| Principle | Old | New |
|---|---|---|
| **State** | Class instance + callback | Zustand store with selectors |
| **Orchestration** | God Class (QueueProcessor) | Composable action functions |
| **Worker protocol** | Untyped postMessage | Discriminated union types |
| **Cancellation** | Not implemented | terminate + respawn per task |
| **Codec coupling** | Direct imports in raster-encode.ts | Plugin registry |
| **SVG optimizer** | SVGO only (JS, slow) | svgtidy WASM primary, SVGO fallback |
| **Dark mode** | Half-implemented CSS | Tailwind 4 `dark:` + system preference + toggle |
| **Constants** | Monolithic 184-line file | Split by domain (limits, formats, presets, errors) |

### 3.2 State Management — Zustand

```typescript
// store/image-store.ts
interface ImageStore {
  items: Map<string, ImageItem>;  // Map for O(1) lookup, no array spread
  itemOrder: string[];            // Maintains display order

  // Actions
  addFiles: (files: File[] | DataTransferItemList) => Promise<void>;
  removeItem: (id: string) => void;
  cancelItem: (id: string) => void;  // NEW: terminates worker
  clearFinished: () => void;
  clearAll: () => void;
  reorderItems: (from: number, to: number) => void;
  setItemFormats: (id: string, formats: string[] | null) => void;
  setItemQuality: (id: string, quality: number | null) => void;

  // Worker bridge (called by pool, not by components)
  _applyWorkerResult: (taskId: string, result: WorkerOutbound) => void;
}
```

Why Zustand over useState+callback:
- **Granular selectors** — `useImageStore(s => s.items.get(id))` re-renders only when that item changes
- **No array spread** — Map-based items with separate order array
- **Actions outside React** — Worker pool can dispatch without React context
- **Built-in persist middleware** — localStorage for settings, free
- **2KB** — lighter than Jotai, simpler than Redux Toolkit

### 3.3 Worker Protocol v2

```typescript
// Inbound (main → worker)
type WorkerInbound =
  | { type: 'OPTIMIZE'; taskId: string; file: File; options: OptimizeTaskOptions }
  | { type: 'CANCEL'; taskId: string }
  | { type: 'PRELOAD_CODEC'; format: ImageFormat };

// Outbound (worker → main)
type WorkerOutbound =
  | { type: 'PROGRESS'; taskId: string; stage: PipelineStage; percent: number }
  | { type: 'RESULT'; taskId: string; blob: Blob; size: number; label: string; timing: StageTiming }
  | { type: 'ERROR'; taskId: string; error: string; code: ErrorCode }
  | { type: 'CANCELLED'; taskId: string };

type PipelineStage = 'decode' | 'classify' | 'resize' | 'encode' | 'svg-optimize' | 'svg-rasterize';

interface OptimizeTaskOptions {
  format: OutputFormat;
  qualityPercent: number;        // 1-100, maps to preset interpolation
  resizeMaxEdge: number;         // 0 = disabled
  stripMetadata: boolean;
  svgOptions: SvgPipelineOptions;
}
```

### 3.4 Worker Pool v2

```typescript
class WorkerPool {
  // Cancellation via terminate + respawn (proven by PicShift)
  cancelTask(taskId: string): void {
    const workerIndex = this.findWorkerForTask(taskId);
    if (workerIndex !== null) {
      this.workers[workerIndex].terminate();
      this.workers[workerIndex] = this.spawnWorker(workerIndex);
      this.callbacks.onCancelled(taskId);
    }
    this.taskQueue = this.taskQueue.filter(t => t.taskId !== taskId);
  }

  // Memory tracking
  private memoryPressure(): boolean {
    return performance?.memory?.usedJSHeapSize > HEAP_WARNING_THRESHOLD;
  }
}
```

### 3.5 Codec Plugin System

```typescript
interface CodecPlugin {
  readonly id: string;
  readonly format: ImageFormat;
  readonly capabilities: {
    encode: boolean;
    decode: boolean;
    lossless: boolean;
    transparency: boolean;
    simd: boolean;
  };
  init(): Promise<void>;
  encode(data: ImageData, options: EncodeOptions): Promise<ArrayBuffer>;
  decode?(data: ArrayBuffer): Promise<ImageData>;
}

// Registry
const codecRegistry = new Map<string, CodecPlugin>();

function registerCodec(plugin: CodecPlugin): void {
  codecRegistry.set(plugin.id, plugin);
}

function getEncoder(format: ImageFormat): CodecPlugin {
  // Returns first registered encoder for format
  // Future: preference system (prefer 'jpegli' over 'mozjpeg' for 'jpeg')
}
```

Default registrations:
- `mozjpeg` → `@jsquash/jpeg` (JPEG encode/decode)
- `libwebp` → `@jsquash/webp` (WebP encode/decode)
- `aomenc` → `@jsquash/avif` (AVIF encode/decode)
- `imagequant-oxipng` → `libimagequant-wasm` + `@jsquash/oxipng` (PNG pipeline)
- `libjxl` → `@jsquash/jxl` (JXL encode/decode)
- `libheif` → `libheif-js` (HEIC decode-only, lazy-loaded)

### 3.6 Quality Slider → Preset Interpolation

The slider (1–100) maps to preset values via linear interpolation:

```typescript
// At quality=100: use current "safe" presets (high quality)
// At quality=75:  use current production presets (balanced)
// At quality=50:  more aggressive (smaller files)

function interpolatePreset(quality: number, preset: ContentPreset): ResolvedPreset {
  const t = quality / 100;  // 0.0 → 1.0
  return {
    avif: { quality: lerp(AVIF_MIN_Q, AVIF_MAX_Q, t), ... },
    webp: { quality: lerp(WEBP_MIN_Q, WEBP_MAX_Q, t), ... },
    jpeg: { quality: lerp(JPEG_MIN_Q, JPEG_MAX_Q, t), ... },
    png:  { quantMin: lerp(PNG_MIN_Q_MIN, PNG_MAX_Q_MIN, t), ... },
  };
}
```

### 3.7 SVG Pipeline v2

```
Input SVG
    │
    ├─→ svgtidy (WASM, ~16µs per icon)
    │     │
    │     ├─ Success? → Use svgtidy output
    │     └─ Error or larger? → SVGO fallback (multipass)
    │
    ├─→ Size comparison: optimized SVG vs raster-wrapped SVG
    │
    ├─→ Rasterize (browser-first or resvg, DPR-aware)
    │     ├─ Classify (photo/graphic)
    │     ├─ Encode with codec plugin
    │     └─ Wrap in SVG with base64 data URI
    │
    └─→ Return smaller: optimized SVG or wrapped SVG
```

---

## 4. New Folder Structure

```
src/
├── app/
│   ├── App.tsx                     # Root layout
│   ├── main.tsx                    # Entry point
│   └── providers.tsx               # Theme + store wrappers
│
├── components/
│   ├── dropzone/
│   │   └── Dropzone.tsx
│   ├── config/
│   │   ├── ConfigPanel.tsx
│   │   ├── QualitySlider.tsx       # NEW
│   │   ├── ResizeControl.tsx       # NEW
│   │   └── FormatSelector.tsx      # Extracted from ConfigPanel
│   ├── results/
│   │   ├── ResultsTable.tsx
│   │   ├── ResultCard.tsx          # NEW: mobile card layout
│   │   └── FormatChip.tsx          # Extracted from ResultsTable
│   ├── preview/                    # NEW
│   │   ├── ImagePreview.tsx        # Before/after split view
│   │   └── PreviewDialog.tsx
│   ├── layout/
│   │   ├── AppHeader.tsx
│   │   ├── AppFooter.tsx           # Extracted from App.tsx
│   │   └── ThemeToggle.tsx         # NEW
│   ├── shared/
│   │   └── ErrorBoundary.tsx
│   └── ui/                         # shadcn primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── slider.tsx              # NEW
│       ├── dialog.tsx              # NEW
│       └── ...
│
├── constants/
│   ├── limits.ts                   # File, pixel, concurrency limits
│   ├── formats.ts                  # Format types, MIME, extensions
│   ├── presets.ts                  # Encoder presets (photo/graphic)
│   ├── errors.ts                   # Error messages
│   ├── ui.ts                       # Confetti, display constants
│   └── index.ts                    # Barrel re-exports
│
├── hooks/
│   ├── useQueueStats.ts
│   ├── useTheme.ts                 # NEW
│   └── useKeyboardShortcuts.ts     # NEW
│
├── lib/
│   ├── codecs/                     # Codec plugin system
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── jpeg.codec.ts
│   │   ├── webp.codec.ts
│   │   ├── avif.codec.ts
│   │   ├── png.codec.ts
│   │   ├── jxl.codec.ts
│   │   └── heic.decoder.ts        # NEW
│   ├── pipeline/
│   │   ├── classify.ts             # Preserved from workers/classify.ts
│   │   ├── resize.ts              # NEW
│   │   ├── raster-pipeline.ts     # decode → resize → classify → encode
│   │   ├── svg-pipeline.ts        # Preserved + enhanced
│   │   └── svg-browser-raster.ts  # Preserved
│   ├── optimizer/
│   │   ├── svgtidy.ts             # NEW: primary
│   │   └── svgo.ts                # Fallback
│   ├── queue/
│   │   ├── types.ts
│   │   ├── intake.ts
│   │   ├── item.ts
│   │   └── results.ts
│   ├── download.ts
│   ├── validation.ts
│   └── utils.ts
│
├── store/
│   ├── image-store.ts              # Zustand: items + actions
│   └── settings-store.ts           # Zustand: persisted options
│
├── styles/
│   ├── index.css                   # Tailwind theme + dark mode
│   └── animations.css
│
├── workers/
│   ├── optimizer.worker.ts         # Entry (typed protocol handler)
│   ├── wasm-init.ts                # WASM module init (resvg, libimagequant)
│   └── worker-pool.ts             # Pool v2 with cancel + respawn
│
└── tests/
    ├── unit/
    │   ├── classify.test.ts
    │   ├── validation.test.ts
    │   ├── queue-results.test.ts
    │   └── codec-registry.test.ts  # NEW
    └── e2e/
        ├── basic.spec.ts
        └── benchmarking.spec.ts
```

---

## 5. Feature Plan

### Phase 1: Foundation (Week 1–2)

| Task | Priority | Notes |
|---|---|---|
| Create new folder structure | High | Move files one-by-one, build must pass after each |
| Zustand stores (image-store, settings-store) | High | Replace QueueProcessor class |
| Typed worker protocol (discriminated unions) | High | WorkerInbound / WorkerOutbound |
| Worker pool v2 with cancellation | High | terminate + respawn |
| Codec plugin system + register all codecs | High | Interface + 6 default plugins |
| Split constants.ts into domain files | Medium | limits, formats, presets, errors |
| Fix all 30 TypeScript errors | High | — |
| Remove dead code (App.css, canvg, calc-s2-rust) | Low | Trivial |
| All existing tests pass | High | Gate for phase completion |

### Phase 2: Missing Basics (Week 2–3)

| Task | Priority | Notes |
|---|---|---|
| Quality slider component + preset interpolation | High | UI → store → worker → different output |
| Resize (max edge) with pica | High | Insert step after decode, before classify |
| HEIC input (libheif-js WASM + Safari native) | High | Lazy-load 1.4MB, createImageBitmap try-first |
| svgtidy as primary SVG optimizer | High | SVGO fallback when svgtidy fails/larger |
| Dark mode (system preference + toggle) | Medium | Tailwind 4 `dark:` + `useTheme` hook |
| Worker cancellation wired to UI | Medium | Remove/clear triggers pool.cancelTask() |

### Phase 3: Differentiators (Week 3–4)

| Task | Priority | Notes |
|---|---|---|
| Before/after split-view preview | High | Canvas-based, triggered by clicking result |
| JXL as first-class output format | Medium | Badge: "Experimental — Safari ✅, Chrome flag" |
| Per-image format/quality overrides | Medium | Already typed — just wire UI |
| Keyboard shortcuts | Low | Space=preview, Delete=remove |
| PWA (manifest + service worker) | Low | Offline after first load |
| Per-stage progress bars | Medium | Already have timing data — surface it |

### Phase 4: Polish (Week 4–5)

| Task | Priority | Notes |
|---|---|---|
| Mobile-responsive results (card vs table) | Medium | ResultCard.tsx for narrow viewports |
| Drag-to-reorder queue | Low | Already have reorderItems action |
| IndexedDB result persistence | Low | Survive page reload |
| Landing page + SEO | Medium | Competitive comparison section |
| Bundle audit + code splitting | Medium | Target ≤ 500KB initial |

---

## 6. Dependency Changes

### Remove

| Package | Reason |
|---|---|
| `canvg` | Never imported. 30KB+ dead weight. |
| `calc-s2-rust` | Never imported. Unknown purpose. |

### Add

| Package | Purpose | Size | Loading |
|---|---|---|---|
| `zustand` | State management | ~2KB | Eager |
| `libheif-js` | HEIC decode (Chrome/Firefox) | ~1.4MB | Lazy (on HEIC file intake) |

### Keep (unchanged)

All `@jsquash/*`, `@resvg/resvg-wasm`, `libimagequant-wasm`, `pica`, `svgo`, `svgtidy`, `fflate`, React 19, Tailwind 4, Radix UI, Lucide, canvas-confetti.

---

## 7. Quality Gates (Preserved)

All existing quality gates carry forward unchanged:

| Gate | Threshold | Script |
|---|---|---|
| SSIM | ≥ 0.98 (adaptive for palette/transparent) | `quality-gate.mjs` |
| PSNR | ≥ 30 dB (adaptive) | `quality-gate.mjs` |
| Size | ≤ baseline × 1.10 (TinyPNG reference) | `benchmarking.spec.ts` |
| SVG quality | SSIM ≥ 0.98 (2× rasterization) | `quality-gate-svg.mjs` |
| E2E smoke | Upload → process → download works | `basic.spec.ts` |

---

## 8. What We're NOT Doing

| Decision | Reason |
|---|---|
| No wasm-vips | 4.6MB bundle. WordPress is actively removing it. |
| No FFmpeg.wasm | 25MB. Video is out of scope. |
| No server component | Zero-server privacy is the #1 differentiator. |
| No animated GIF/WebP/AVIF | Complexity explosion for niche use case. |
| No "AI-powered" compression | Marketing vapor. No WASM advantage over codecs. |
| No zenjpeg (jpegli-rs) | AGPL license. Monitor for permissive fork. |
| No oxvg | 9.5MB WASM binary. Pre-alpha. Worse ratio than SVGO. |
| No svag | Only 30% reduction vs SVGO's 60%. |

---

## 9. Success Criteria

The revamp is complete when:

1. ✅ Zero TypeScript errors (`tsc -b --noEmit` clean)
2. ✅ All quality gates pass (SSIM, PSNR, size)
3. ✅ Quality slider produces visibly different output at 50 vs 100
4. ✅ HEIC from iPhone decodes in Chrome and Firefox
5. ✅ Before/after preview renders for any processed image
6. ✅ Worker cancellation terminates within 100ms
7. ✅ Dark mode toggles without flash of unstyled content
8. ✅ Initial bundle ≤ 500KB (WASM codecs lazy-loaded)
9. ✅ First Contentful Paint < 1.5s on 4G
10. ✅ 10 images batch completes within 15s on mid-range hardware

---

## 10. Migration Strategy

This is a restructure-and-extend, not a burn-and-rebuild:

1. **Create new folder structure alongside old** — no files deleted initially
2. **Move one module at a time** — constants → types → codecs → pipeline → store → components
3. **After each move, ensure `npm run build` succeeds**
4. **Delete old files only after new ones are verified**
5. **Never break existing tests during migration**
6. **Git commit at each stable checkpoint** — easy rollback if something breaks

### Move Order

```
Step 1: constants.ts → constants/{limits,formats,presets,errors}.ts
Step 2: queue-types.ts → lib/queue/types.ts (add missing fields)
Step 3: validation.ts → lib/validation.ts (add isHeicDecodeLikelySupported)
Step 4: classify.ts → lib/pipeline/classify.ts
Step 5: Create lib/codecs/* (new files, register existing @jsquash)
Step 6: raster-encode.ts → lib/pipeline/raster-pipeline.ts (use codec registry)
Step 7: svg-pipeline.ts + svg-browser-raster.ts → lib/pipeline/svg-*
Step 8: Create store/image-store.ts + store/settings-store.ts
Step 9: worker-pool.ts → workers/worker-pool.ts (add cancel, typed protocol)
Step 10: optimizer.worker.ts → workers/optimizer.worker.ts (typed message handler)
Step 11: QueueProcessor → delete (actions now live in store)
Step 12: Components → split and relocate
Step 13: Delete App.css, remove canvg, remove calc-s2-rust
```

---

## 11. Competitive Positioning After Revamp

After implementing through Phase 3, TinyIMG will be the **only tool** that combines:

| Capability | Squoosh | PicShift | TinyPNG | TinyIMG v2 |
|---|---|---|---|---|
| Client-side privacy | ✅ | ✅ | ❌ | ✅ |
| Batch (200+ files, ZIP, folders) | ❌ | ✅ | ❌ | ✅ |
| Content-aware presets | ❌ | ❌ | ✅ (server) | ✅ |
| Quality slider | ✅ | ✅ | ❌ | ✅ |
| Before/after preview | ✅ | ❌ | ❌ | ✅ |
| Resize | ✅ | ✅ | ❌ | ✅ |
| SVG optimization + rasterization | ❌ | ❌ | ❌ | ✅ |
| HEIC input | ❌ | ✅ | ❌ | ✅ |
| JXL output | ✅ | ❌ | ❌ | ✅ |
| Dark mode | ❌ | ❌ | ❌ | ✅ |
| Worker cancellation | ❌ | ✅ | N/A | ✅ |
| Free + unlimited | ✅ | ✅ | ❌ | ✅ |

**No single competitor fills every column.** TinyIMG v2 will.

---

*"Drop any image. Get the smallest file with the best quality, in any format, in seconds. It never leaves your browser."*
