# TinyIMG

Browser-native image optimizer built with React + Vite + WASM codecs.
All optimization runs on-device.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 4
- WASM/image pipeline: `@jsquash/*` (incl. JPEG XL encode), `libimagequant-wasm`, `@resvg/resvg-wasm`, `svgo`, `svgtidy`
- UI primitives aligned to shadcn patterns (`src/components/ui/*`)

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

- **SharedArrayBuffer:** Full zero-copy shared memory between threads usually requires cross-origin isolation headers (`Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`). The app uses **transferable buffers** and a worker pool without requiring those headers for static hosting.
- **Codec warm-up:** In production/preview builds, the app may preload the WebP WASM module on the main thread to shave cold latency (skipped in Vite dev to avoid Wasm ESM transform issues).
- **WASM streaming:** Resvg and libimagequant use `compileStreaming` with an `arrayBuffer` fallback where needed. jSquash packages typically select SIMD-capable WASM when the browser supports it; use a current evergreen browser for best speed.

## Non-goals (v1)

- No **animated** GIF / WebP / AVIF output (first-frame GIF decode only).
- No server-side processing or uploads.
- **JPEG XL:** experimental output; see [JPEG XL support](https://caniuse.com/jpeg-xl) in browsers. JPEG sources at **100% quality** → **lossless JXL** for a practical recompression path.

## Encoder notes

- **JPEG:** MozJPEG via `@jsquash/jpeg` (Jpegli deferred — see [docs/JPEGLI.md](docs/JPEGLI.md)).
- **SVG:** svgtidy + SVGO fallback — see [docs/SVG-BENCHMARK.md](docs/SVG-BENCHMARK.md).

## Limits

- Per file: 25 MB
- ZIP upload: 25 MB max (in-memory)
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

| Script | Description |
|---|---|
| `dev` | Start local Vite dev server |
| `build` | Production build (`tsc` + Vite) |
| `preview` | Preview production build locally |
| `lint` | ESLint checks |
| `typecheck` | TypeScript project checks |
| `test` | Unit tests (Vitest) |
| `test:e2e` | Playwright smoke (`basic.spec.ts`); serves **`vite preview`** on port 5174 (builds first locally; CI reuses the prior `build` step) |
| `test:e2e:benchmark` | Full benchmarking E2E suite (same preview server) |
| `test:quality` | Raster + SVG quality gates |
| `test:full` | Unit + E2E smoke + quality gates |

## Architecture and docs

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Implementation map: [docs/IMPLEMENTATION-MAP.md](docs/IMPLEMENTATION-MAP.md)
- Acceptance criteria: [docs/ACCEPTANCE-CRITERIA.md](docs/ACCEPTANCE-CRITERIA.md)
- Cloudflare deployment runbook: [docs/CLOUDFLARE-DEPLOYMENT.md](docs/CLOUDFLARE-DEPLOYMENT.md)
- Contributing guide: [CONTRIBUTING.md](CONTRIBUTING.md)

## CI

GitHub Actions workflow runs:

1. `lint`
2. `typecheck`
3. `test`
4. `build`
5. `test:e2e`
6. `test:quality`
