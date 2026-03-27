# Production-Grade Audit Report: TinyIMG (Executed 2026-03-16)

**Audit plan:** [AUDIT-PLAN-PRODUCTION-GRADE.md](./AUDIT-PLAN-PRODUCTION-GRADE.md)  
**Scope:** Full codebase audit for production-grade parity with TinyPNG on quality, size, performance, features, and reliability.  
**Method:** Verify from code and external sources; no assumptions.

---

## Part 1 — Architecture and Code Path Map (Verified)

### 1.1 Entry points and runtime model

| Item | Verified |
|------|----------|
| **Entry points** | **Confirmed.** Single entry: `index.html` → `<script type="module" src="/src/main.tsx">` → `App.tsx`. No server, no CLI. `package.json` scripts: `dev`, `build`, `preview`, `test:e2e`, `test:quality`, `test:full` — no `start` server. |
| **Where optimization runs** | **Confirmed.** 100% in-browser. `QueueProcessor` (main thread) creates workers from `src/workers/optimizer.worker.ts` (Vite resolves path). No backend API. |
| **Storage** | **Confirmed.** No persistent storage. Files and results are in-memory (File/Blob); `URL.createObjectURL` for download; "Download all" builds ZIP in-memory via `fflate`. No IndexedDB/localStorage/server upload of image bytes. |
| **Config** | **Confirmed.** All config in-memory: `GlobalOptions` in `queue-processor.ts` (`formats`, `useOriginalFormats`, `svgInternalFormat`). Worker presets hardcoded in `optimizer.worker.ts` (`PRESETS.photo`, `PRESETS.graphic`). No config file or env for optimization. |

### 1.2 Data flow

- **Add files:** `addFiles()` → `createItem()` → `getFormatsToProcess()` → items pushed to `queue`; `processNext()` enqueues one task per (item, format) into `taskQueue`, assigns to idle workers via `assignNextTask()`. Worker receives `{ id, file, options }`. File is structured-cloned (supported in modern browsers).
- **Worker (raster):** `createImageBitmap(file)` → `getImageData(bitmap)` (OffscreenCanvas) → `checkPixelLimit()` → `classifyContent(imageData)` → preset → encode (AVIF/WebP/JPEG/PNG) → `postMessage({ id, blob, size, format, label, status: 'success' })`. All branches traced.
- **Worker (SVG):** `file.text()` → SVGO optimize → Resvg rasterize 2× → `createImageBitmap` → classify → encode internal → wrap in `<svg><image href="data:..."/>` or keep optimized SVG; choice by `wrapperSize < optimizedSvgSize * 0.95`.
- **Response:** `handleWorkerMessage()` updates `item.results[format]`, revokes old object URL, creates new one; when all formats for item are done, `processNext()`. No retry; no dead-letter queue.

### 1.3 Dependencies

- **Bundled (app/worker):** From imports: `fflate` (queue-processor), `@jsquash/*`, `@resvg/resvg-wasm`, `svgo`, `libimagequant-wasm` (worker). Vite bundles these. **Issue:** `fflate` is in **devDependencies** but is a runtime dependency (ZIP unzip/zip). Same for `@jsquash/*`, `@resvg/resvg-wasm`, `svgo` — they are runtime deps but in devDependencies. Only `libimagequant-wasm` is in **dependencies**.
- **Node-only (not bundled):** `sharp`, `ssim.js` — used only in `scripts/quality-gate.mjs` and `scripts/quality-gate-svg.mjs`. Correct.
- **@jsquash versions (from package.json):** avif ^2.1.1, jpeg ^1.6.0, oxipng ^2.3.0, webp ^1.5.0. Options verified against meta.js in Part 3.
- **libimagequant-wasm:** ^0.2.4. API: ImageQuantizer, setQuality, quantizeImage, encode_palette_to_png, free. Used in worker only.
- **resvg / SVGO:** resvg for rasterization; SVGO with `multipass: true`, `plugins: ['preset-default', 'removeDimensions']`. removeDimensions strips width/height — document that responsive SVGs may need different handling if dimensions matter.

### 1.4 Configuration and baselines

- **expected.jsonc:** Keys = filenames; values = format → size string ("26KB", "2MB") or single string for SVG ("0.7KB"). E2E `parseSize()` parses "KB"/"MB"/"GB". Verified: "2MB" → 2×1024×1024. Tolerance 1.10× (or size-overrides.jsonc).
- **quality-thresholds.jsonc:** Per-file overrides; adaptive rules (palette vs truecolor, transparent+WebP) in quality-gate.mjs.
- **size-overrides.jsonc:** Empty; all use 1.10×.

---

## Part 2 — TinyPNG and 2026 Best Practices (Verified)

### 2.1 TinyPNG (sources)

- **Limits (Tinify API):** Max file size **500 MB**; max canvas **256 MP**; max width/height **32,000 px**. Source: [Tinify Help](https://help.tinify.com/help/is-there-a-file-size-limit-for-images) (last updated Jun 2023).
- **TinyIMG limits:** MAX_FILE_SIZE = 25 MB, MAX_PIXELS = 256M. So: **stricter file size** (25 MB vs 500 MB), **same pixel cap** (256M).
- **Formats (TinyPNG public):** PNG and JPEG. API also supports AVIF, WebP, resize, convert ([Tinify](https://tinypng.com/developers/how-it-works)). So "parity" for WebP/AVIF is industry best practice; TinyPNG does not publish quality params.
- **Industrial Empathy:** Reference [AVIF and WebP quality settings](https://industrialempathy.com/posts/avif-webp-quality-settings) (Malte Ubl) — JPEG 80 ≈ AVIF 64, WebP 82 — still the standard citation for perceptual parity (dssim-based). Worker uses lower (AVIF 55/56, WebP 72/74, JPEG 74/76) for smaller size; design doc states quality gate (SSIM ≥ 0.98, PSNR ≥ 30 dB) and size ≤ baseline × 1.10.

### 2.2 Format support

- **Input (worker):** PNG, JPEG, WebP, AVIF (createImageBitmap), SVG (text path). No BMP, TIFF, GIF.
- **Output:** original, webp, avif, jpeg, png, svg (for SVG: optimized or wrapped). MIME and extensions: image/jpeg, image/webp, image/avif, image/png, image/svg+xml.

### 2.3 Codec options (verified against libs)

- **AVIF:** defaultOptions in meta.js: quality, speed, subsample (1), chromaDeltaQ, enableSharpYUV, tune. Worker uses subsample 1 (photo) and 3 (graphic); valid.
- **WebP:** quality, method (4 or 5), use_sharp_yuv 1. Valid.
- **JPEG (MozJPEG):** chroma_subsample in meta default 2. Worker uses 1 (4:2:0 photo) and 0 (4:4:4 graphic). Library accepts number; 0/1/2 are standard.
- **PNG (oxipng):** level 2 (photo) and 4 (graphic), interlace: false, optimiseAlpha: true. meta.js default optimiseAlpha: false; we override. British spelling `optimiseAlpha` confirmed in lib.

### 2.4 Baselines and quality targets

- **expected.jsonc:** Comment says "TinyPNG reference" or "quality-mode reference run". Not verified how values were obtained; document in README or expected.jsonc.
- **Worker vs Industrial Empathy:** Lower quality settings (55–76) are intentional for size; quality gate (SSIM/PSNR) and size gate (≤ 1.10×) define "done."

### 2.5 Dependencies audit

- **bun audit:** Run on 2026-03-16: **No vulnerabilities found.**
- **Lockfile:** bun.lock present; recommend committing and using in CI for reproducibility.
- **fflate:** Runtime dependency but in devDependencies. **Recommendation:** Move `fflate` to dependencies. Optionally move all bundled runtime deps (@jsquash/*, @resvg/resvg-wasm, svgo) to dependencies for correct semantics and `npm install --production` behavior.

---

## Part 3 — Findings: Correctness

### 3.1 Worker and encoding

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **F1** | Format "jpg" vs "jpeg": Worker normalizes; queue sends format from UI. ConfigPanel/format list uses "jpeg" for JPEG. | Low. | Keep single canonical "jpeg" in types; document. |
| **F2** | Blob type for JPEG: `type: \`image/${effectiveFormat === 'jpeg' ? 'jpeg' : effectiveFormat}\`` — correct. | None. | No change. |
| **F3** | SVG internal format: Worker uses `options.svgInternalFormat \|\| 'webp'`; queue default svgInternalFormat: 'webp'. Consistent. | None. | No change. |
| **F4** | toBase64 uses `String.fromCharCode(...chunk)` with chunk size 8192. Spread of 8k elements can hit engine call-stack limits in some environments. | Medium for very large SVG rasters. | Replace with loop: `for (let j = 0; j < chunk.length; j++) out += String.fromCharCode(chunk[j]);` to avoid spread. |
| **F5** | Timeout: On timeout we post error once; on throw we clear timeout and post error; if timedOut we return without second post. Single post per task. | None. | No change. |
| **F6** | **PNG quantizer free:** If `png.optimise()` throws (raster or SVG PNG branch), `res.free()` / `q.free()` (or `qRes.free()` / `quantizer.free()`) are never called. WASM memory can leak. | **High.** | Wrap quantizer and result in try/finally: create quantizer and call quantize; in finally, call res.free() and quantizer.free(). Apply in both raster PNG and SVG-internal PNG branches. |
| **F7** | createImageBitmap called with no options. Defaults are document-dependent; typically sRGB, premultiplyAlpha default. | Low. | Document default behavior; add options only if correctness issues appear (e.g. color space). |

### 3.2 Queue and UI

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **F8** | getFormatsToProcess: useOriginalFormats → originalFormat; "jpg" normalized to "jpeg". Verified correct. | None. | No change. |
| **F9** | Multiple formats: one task per format; result key is format; UI shows all. Verified. | None. | No change. |
| **F10** | ZIP: getMimeType returns application/octet-stream for unknown ext; we skip adding when type is octet-stream. Allowed exts = same as isValidType. | Low. | Document; optionally use explicit allowlist for ZIP contents. |

### 3.3 Quality gates and E2E

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **F11** | ssim.js: package exports both `exports.ssim` and `exports.default = ssim`. quality-gate.mjs uses `const { ssim } = require('ssim.js')`; quality-gate-svg.mjs uses `import ssim from 'ssim.js'`. Both work. | None. | No change. |
| **F12** | PSNR: quality-gate.mjs uses MSE over all channels, then 10*log10(255²/MSE). Standard formula. | None. | Document in QUALITY-RESEARCH or script comment. |
| **F13** | E2E export: base from filename, ext from format; parseSize("2MB") = 2097152. expected.jsonc keys match test-images; format from extension. Verified. | None. | No change. |
| **F14** | Adaptive thresholds (0.35/12, 0.80/19) are empirical; QUALITY-RESEARCH.md states this. | Low. | Add one-line "tunable" note; consider overrides in quality-thresholds.jsonc. |

### 3.4 SVG

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **F15** | Resvg 2×: worker and quality-gate-svg both use width×2. Consistent. | None. | Document 2× as reference scale. |
| **F16** | Wrapper vs optimized: 0.95 threshold. Heuristic. | Low. | Document; consider named constant WRAPPER_SIZE_THRESHOLD. |

---

## Part 4 — Findings: Performance

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **P1** | maxConcurrency 2–6; no per-worker or global pixel budget. Many large images can use high memory. | Medium. | Document; consider cap on total decoded pixels across workers. |
| **P2** | classifyContent: single pass, sampled when >4M px. Acceptable. | Low. | Measure on 10M px if needed; document. |
| **P3** | Resvg and libimagequant init on first use. First SVG and first PNG pay init cost. | Low. | Document; optional preload on idle. |
| **P4** | handleZip reads entire ZIP into memory. 25 MB ZIP = 25 MB+ spike. | Medium. | Document limit; consider separate ZIP size cap. |
| **P5** | downloadAll builds full ZIP in memory. Many/large results can OOM. | Medium. | Cap number of files or total size; or stream if fflate supports. |

---

## Part 5 — Findings: Features and Gaps

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **G1** | No server/CLI; browser-only. Quality gates use Node (sharp) on E2E output. | By design. | Document; if batch/server needed, add separate Node path or document scope. |
| **G2** | No EXIF/ICC preserve or strip. Browser decode/encode may drop metadata. | Low. | Document; add metadata handling only if required. |
| **G3** | No GIF/APNG/BMP/TIFF. createImageBitmap + SVG only. | By design. | List supported formats in README and UI. |
| **G4** | ~~Remote URL fetch via proxy~~ **Removed:** URL ingestion and Workers proxy deleted; app accepts local files, folders, and ZIPs only. | Resolved. | — |
| **G5** | No retry on encode failure. | Low. | Document; optional: one retry with photo preset. |
| **G6** | No per-task progress (e.g. 50% encode). User may see no progress for up to 120s on large image. | Low. | Document; optional: encoder progress if libs support. |

---

## Part 6 — Findings: Reliability

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **R1** | Task timeout 120s: worker posts error after 120s but does not abort encode. CPU continues until done or throw. | Medium. | Document; consider AbortController if libs support. |
| **R2** | **No worker.onerror.** If worker throws uncaught, main thread may never get a message; item stays "processing." | **High.** | Add `worker.onerror` in QueueProcessor: mark item (or all formats for that item) as error, set error message, call processNext() and onUpdate. Optionally replace worker. |
| **R3** | updateOptions clears all results and re-queues all items. Frequent toggles cause redundant work. | Low. | Document; optional debounce or re-queue only affected formats. |
| **R4** | No persistence; refresh loses queue. | Low. | Document; optional sessionStorage with size limit. |

---

## Part 7 — Findings: Security

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **S1** | ~~Proxy SSRF via addUrls~~ **Removed** with URL feature. | Resolved. | — |
| **S2** | Validation by extension and MIME in ZIP; no magic-byte check. Wrong-extension file can reach worker; createImageBitmap may fail or decode unexpectedly. | Low (client-only). | Document; optional magic-byte check before queue. |
| **S3** | User SVG not rendered in UI (only to worker and download). No inline innerHTML of user SVG. | None. | Document. |
| **S4** | No rate limit; client-side only. | N/A. | Document. |

---

## Part 8 — Observability and Deployment

| ID | Finding | Impact | Recommendation |
|----|---------|--------|-----------------|
| **O1** | No metrics or error reporting. | Low. | Optional: performance marks, console timing, or Sentry. |
| **O2** | No health/smoke check. | Low. | Optional: minimal E2E that runs one image and asserts success. |
| **O3** | Deployment documented in README and `CLOUDFLARE-DEPLOYMENT.md`; static `dist/` only, no backend. | Low. | Keep deploy docs in sync with CI. |
| **O4** | test:full = E2E then quality gates. Playwright needs browser. | Low. | Document Node version; recommend pinning and caching in CI. |

---

## Part 9 — Prioritized Summary

### Critical

- **F6 — PNG quantizer not freed on png.optimise() throw.** WASM memory leak on rare encode failure. **Fix:** Wrap both PNG paths (raster and SVG-internal) in try/finally; call res.free() and quantizer.free() in finally.

### High

- **R2 — No worker.onerror.** Uncaught worker errors leave items stuck "processing." **Fix:** In QueueProcessor constructor, for each worker set `w.onerror = (ev) => { ... }`: find item by current task id if available, mark result(s) error, set workerIdle, assignNextTask, onUpdate. Optionally replace worker.
- **Deps — fflate (and optionally other runtime deps) in devDependencies.** **Fix:** Move `fflate` to dependencies. Consider moving @jsquash/*, @resvg/resvg-wasm, svgo to dependencies for correct production install semantics.

### Medium

- **F4 — toBase64 spread:** Replace spread with loop for large buffers.
- **P4, P5 — ZIP memory:** Document limits; consider ZIP size cap and downloadAll cap or streaming.
- **P1 — Concurrency/memory:** Document; consider total decoded pixel cap.
- ~~**G4, S1 — Proxy**~~ **Resolved:** URL ingestion and proxy removed.
- **R1 — Timeout:** Document that encode is not aborted.

### Low

- **F7, F10, F14, F16:** Document defaults and heuristics.
- **G2, G3, G5, G6, R3, R4, O1–O4:** Document or add optional improvements.

---

## Part 10 — Verification Checklist

- [x] All entry points and config sources traced and documented.
- [x] TinyPNG comparison based on Tinify Help (500 MB, 256 MP, 32k px); Industrial Empathy reference verified.
- [x] @jsquash / libimagequant / oxipng options checked against library meta.js and encode flow.
- [x] ssim.js: both require({ ssim }) and import default work; quality gates use correct API.
- [x] E2E parseSize and expected.jsonc format verified; size tolerance 1.10×.
- [x] Every finding has a concrete recommendation (fix, config, or "document").
- [x] Industrial Empathy and Tinify sources cited.

---

## Recommended Immediate Actions

1. ~~**Implement F6 fix:** try/finally for PNG quantizer and result in `optimizer.worker.ts` (raster PNG and SVG PNG branches).~~ **Done.**
2. ~~**Implement R2 fix:** Add worker.onerror in `queue-processor.ts`; mark affected item error and continue queue.~~ **Done.**
3. ~~**Move fflate to dependencies** in package.json.~~ **Done.**
4. ~~**Document** in README.~~ Done.
5. ~~**Optional:** F4, G4 proxy env, O3 deploy.~~ Done. **Update 2026-03-25:** G4/S1 proxy surface removed entirely.

---

## Audit Fixes Applied (2026-03-16)

- **F6:** Both PNG paths in `src/workers/optimizer.worker.ts` now use try/finally so `res.free()` and `quantizer.free()` (or `qRes.free()` / `quantizer.free()`) run even when `png.optimise()` throws.
- **R2:** `QueueProcessor` in `src/lib/queue-processor.ts` now tracks the current task per worker (`currentTaskByWorker`) and has `worker.onerror` → `handleWorkerError()` to mark that task’s result as error, clear the task, set worker idle, and continue the queue.
- **Deps:** fflate, @jsquash/*, @resvg/resvg-wasm, svgo in dependencies.
- **Execute-everything:** F4 toBase64 loop; F16 WRAPPER_SIZE_THRESHOLD; P4/P5 ZIP and download-all caps; G5 one retry photo; S2 magic-byte check; O1 performance marks + timing; O2 smoke E2E; O3 README deploy/formats/limits/CI; R3 debounce updateOptions; full README and QUALITY-RESEARCH/expected.jsonc/quality-gate docs.
