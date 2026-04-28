# TinyIMG

Browser-native image optimizer built with React + Vite + WASM codecs.
All optimization runs on-device.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- WASM/image pipeline: `@jsquash/*` (incl. JPEG XL encode), `libimagequant-wasm`, `@resvg/resvg-wasm`, `svgo`
- UI primitives aligned to shadcn patterns: button, card, select, checkbox, badge, accordion under `src/components/ui/`
- Queue UI: virtualized table (`react-virtuoso`) under `src/components/results/`

## Architecture (overview)

- **Queue state:** Legend State observables in the image store; worker results and thumbnails integrate with the same session model.
- **Storage:** Hybrid adapters (OPFS where available, IndexedDB + in-memory fallbacks) for originals and outputs; see `src/storage/` and `src/lib/storage/`.
- **Workers:** Pool v2 dispatches raster encode, SVG pipeline, and thumbnail tasks; resize uses CPU / `OffscreenCanvas` paths (no WebGPU resize pipeline).
- **Zip:** `@zip.js/zip.js` with shared configuration in `src/lib/zip-js-config.ts`.

## SVG Optimization Engine (2026 Standard)

TinyIMG uses a high-IQ, single-pass pipeline for SVG optimization that balances file size, visual fidelity, and browser rendering performance.

### 1. Adaptive Output Strategy

The engine automatically classifies incoming SVGs into two output paths based on expert-approved 2026 thresholds:

- **Path A: Optimized Vector (Standard)**
  - Used for icons, logos, and simple illustrations.
  - Keeps the file as a sharp, scalable XML vector.
  - **Force-Vector Rule**: Files < 4KB always remain vectors to ensure zero-latency rendering.
- **Path B: Rasterized SVG Wrapper (Performance-First)**
  - Used for extremely complex vectors (e.g., architectural maps, traced photos) that would cause browser "jank" (GPU/CPU lag).
  - Rasterizes the SVG into a high-fidelity **AVIF/WebP** bitmap and wraps it in a responsive SVG container.
  - **Complexity Threshold**: Triggered if nodes > 1,500 OR path segments > 5,000.
  - **Hybrid Threshold**: Triggered if embedded raster data > 32KB, or > 4KB while accounting for > 50% of the total file size.

### 2. Unified AST Pipeline

Unlike standard tools that run multiple passes, TinyIMG uses a **Unified AST Visitor**. During the SVGO optimization pass, a custom plugin walks the Abstract Syntax Tree once to extract perfect metadata (node counts, raster bytes, filter depth) with zero additional CPU overhead.

### 3. Professional Suite (SVGOMG-Grade)

The engine implements 40+ professional-grade optimization flags, including:

- **Smart Geometry**: Path merging, group collapsing, and redundant attribute stripping.
- **Precision Decision**: Precision 3 for paths (high fidelity) and Precision 5 for transforms (layout stability).
- **Collision Protection**: Automatic ID prefixing to prevent broken masks when multiple SVGs are inlined on a page.
- **Accessibility**: Explicitly preserves `viewBox` and `title` tags for perfect responsiveness and screen-reader support.

## Supported formats

- **Input:** PNG, JPEG/JPG, WebP, AVIF, SVG, GIF (first frame), BMP, TIFF (if the browser decodes it), HEIC/HEIF (Safari / iOS WebKit); folder/ZIP intake
- **Output:** WebP, AVIF, JPEG, PNG, **JPEG XL (experimental)**, original-preserving mode
- **SVG path:** optimized SVG or rasterized pipeline based on config and size heuristics

Files are validated by extension + magic bytes before processing.

### SVG export density (Global Config)

- **Display (default):** Raster is approximately **logical width × DPR** by **logical height × DPR** pixels (DPR 1–3, default 2). The SVG wrapper still declares **logical** `width`/`height`/`viewBox`, so on-screen size matches the original SVG while the embedded bitmap stays sharp on high-DPI displays (similar idea to Playwright `device_scale_factor`). Flat WebP/AVIF/PNG/JPEG/JXL exports use the **same** bitmap dimensions as the wrapper payload.
- **Legacy:** Bitmap is exactly **intrinsic W×H** after internal supersampling and high-quality downscale (previous default behavior).
- **Raster engine (display mode):** **Auto** tries the **browser** (`createImageBitmap` + `OffscreenCanvas`) first for Chromium-like results, then **resvg**. **Browser only** / **resvg only** pin one engine. Output can differ slightly between browsers; resvg is deterministic but may not match Chrome pixel-for-pixel.

If `W×H×DPR²` would exceed the **256 MP** pixel guard, DPR is **reduced automatically** (minimum 1).

## Performance notes

- **Cross-origin isolation:** `vite.config.ts` sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` on the **dev** and **preview** servers (port 5174) so WASM and advanced threading behave like a cross-origin isolated context. For a static host, set equivalent headers if you need the same guarantees.
- **Transferable buffers:** The worker pool uses transferable buffers where appropriate to avoid extra copies on the hot path.
- **Codec warm-up:** In production/preview builds, the app may preload the WebP WASM module on the main thread to shave cold latency (skipped in Vite dev to avoid Wasm ESM transform issues).
- **WASM streaming:** Resvg and libimagequant use `compileStreaming` with an `arrayBuffer` fallback where needed. jSquash packages typically select SIMD-capable WASM when the browser supports it; use a current evergreen browser for best speed.

## Non-goals (v1)

- No **animated** GIF / WebP / AVIF output (first-frame GIF decode only).
- No server-side processing or uploads.
- **JPEG XL:** experimental output; see [JPEG XL support](https://caniuse.com/jpeg-xl) in browsers. JPEG sources at **100% quality** → **lossless JXL** for a practical recompression path.

## Encoder notes

- **JPEG:** MozJPEG via `@jsquash/jpeg`.
- **SVG:** Unified SVGO v4+ AST pipeline (SVGOMG-grade heuristics in code under `src/lib/optimizer` and `src/workers/svg-pipeline.ts`).

## Limits

- Per image file: 25 MB
- ZIP archive (compressed upload): 2 GB max
- ZIP extraction: 1000 files max, 200 MB uncompressed total
- Pixel guard: 256 MP max
- Batch download guard: 200 files and 80 MB
- Queue cleanup: Automatic URL revocation on clear/remove

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:5174`.

## Scripts

| Script                 | Description                                                                   |
| ---------------------- | ----------------------------------------------------------------------------- |
| `dev`                  | Start local Vite dev server                                                   |
| `build`                | Production build (`tsc` + Vite)                                               |
| `build:analyze`        | Production build with Rollup visualizer (`dist/stats.html`)                   |
| `check:perf`           | Check bundle size against `scripts/perf-budgets.json`                         |
| `preview`              | Preview production build locally                                              |
| `lint`                 | ESLint                                                                        |
| `typecheck`            | TypeScript project checks                                                     |
| `knip`                 | Find unused files, deps, and exports ([knip](https://github.com/webpro/knip)) |
| `compiler:healthcheck` | React Compiler healthcheck on `src`                                           |
| `test`                 | Unit tests (Vitest)                                                           |
| `test:e2e`             | Playwright smoke (`basic.spec.ts`); `vite preview` on port 5174               |
| `test:e2e:benchmark`   | Full benchmarking E2E suite (same preview server)                             |
| `test:quality`         | Raster + SVG quality gates                                                    |
| `test:full`            | Unit + E2E smoke + quality gates                                              |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local development and contribution guidelines.

## CI

GitHub Actions runs, in order:

1. `lint`
2. `typecheck`
3. `knip`
4. `test`
5. `build`
6. `test:e2e`
7. `test:quality`
