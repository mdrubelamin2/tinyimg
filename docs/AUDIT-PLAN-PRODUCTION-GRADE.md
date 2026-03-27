# Production-Grade Audit Plan: TinyIMG vs TinyPNG Parity (2026)

**Persona:** Senior tech lead and domain expert in image processing, optimization, compression, and conversion. Zero tolerance for hand-waving: do not assume, verify.

**Hard rules (never violate):**
- Do not assume. For tool choices, algorithms, benchmarks, or standards: look up current (2026) docs, GitHub issues, and industry sources before concluding.
- Prefer established, industry-standard solutions over custom code. Custom code must justify why it exists.
- Be brutally honest. Call out flaws, loopholes, missing features, bugs, performance issues, and vague or missing details. Each finding → concrete fix or improvement.
- Anchor in this repo: start from project root and key entry points; trace data flow, config, and dependencies before recommending.
- Challenge everything. Libraries, algorithms, and decisions must be justified with up-to-date evidence.

**Scope:** Audit the entire codebase so the application can be production-grade and at least on par with TinyPNG.com on: output image quality, compressed size, performance, feature set, and reliability. Go deep: algorithms, formats, encoding options, error handling, tests, security, observability, and deployment.

---

## Part 1 — Architecture and Code Path Map (Verify, Do Not Assume)

Execute these steps first. Document every finding; do not skip.

### 1.1 Entry points and runtime model

- [ ] **Entry points:** Confirm there is no server/CLI. Only entry: browser `index.html` → `main.tsx` → `App.tsx`. No Node/Deno/Bun server for optimization; no CLI that runs the worker. Verify `package.json` scripts: no `start` server, only `dev` (Vite), `build`, `preview`, `test:*`.
- [ ] **Where optimization runs:** Entire pipeline is in-browser: `QueueProcessor` (main thread) spawns workers from `src/workers/optimizer.worker.ts` (Vite resolves `../workers/optimizer.worker.ts`). No backend API for image processing. Document this explicitly.
- [ ] **Storage:** No persistent storage. Files live in memory (File/Blob); results are Blobs with `URL.createObjectURL` for download. "Download all" builds a ZIP in-memory via `fflate`. Confirm no IndexedDB, localStorage, or server upload of image bytes.
- [ ] **Config:** All config is in-memory (`GlobalOptions` in `queue-processor.ts`: `formats`, `useOriginalFormats`, `svgInternalFormat`). No config file, no env vars for optimization parameters. Worker presets are hardcoded in `optimizer.worker.ts` (`PRESETS.photo`, `PRESETS.graphic`).

### 1.2 Data flow (trace end-to-end)

- [x] **Add files:** `addFiles()` → `createItem()` → `getFormatsToProcess()` → items pushed to `queue`; `processNext()` enqueues tasks (one per format per file) into `taskQueue`, assigns to workers via `assignNextTask()`. Worker receives `{ id, file, options }`. Document: file is passed by reference (structured clone); confirm browser supports File in postMessage (all modern browsers do).
- [ ] **Worker pipeline (raster):** `createImageBitmap(file)` → `getImageData(bitmap)` (OffscreenCanvas) → `checkPixelLimit()` → `classifyContent(imageData)` → preset selected → encode (AVIF/WebP/JPEG/PNG via @jsquash + libimagequant for PNG) → `postMessage({ id, blob, size, format, label, status: 'success' })`. Trace every branch (original, webp, avif, jpeg, png).
- [ ] **Worker pipeline (SVG):** `file.text()` → SVGO optimize → Resvg rasterize 2× → `createImageBitmap` → classify → encode internal (avif/webp/jpeg/png) → wrap in `<svg><image href="data:..."/></svg>` or keep optimized SVG → postMessage. Document decision: wrapper vs optimized SVG by size comparison (wrapper &lt; 0.95× optimized size).
- [ ] **QueueProcessor response:** `handleWorkerMessage()` updates `item.results[format]`, revokes old object URL, creates new one, sets `downloadUrl`; when all formats for item are done, `processNext()` runs. No retry on encode failure; no dead-letter queue.

### 1.3 Dependencies (image stack)

- [ ] **List and pin:** From `package.json`: production deps `calc-s2-rust`, `libimagequant-wasm`, `react`, `react-dom`. Dev deps include `@jsquash/avif`, `@jsquash/jpeg`, `@jsquash/oxipng`, `@jsquash/webp`, `@resvg/resvg-wasm`, `svgo`, `sharp`, `ssim.js`, `fflate`, etc. Verify which are bundled into the app (Vite build) vs only used in Node scripts (quality-gate.mjs, quality-gate-svg.mjs). **Critical:** `sharp` is Node-only; used only in quality gates. Worker uses only WASM/browser-safe libs.
- [ ] **@jsquash versions:** Document current versions. Check npm/GitHub for 2025–2026 releases and breaking changes. Verify encode option names and valid ranges against each package’s `meta.js` / types (e.g. AVIF `subsample` 1 vs 3, WebP `method`, MozJPEG `chroma_subsample` 0/1/2).
- [ ] **libimagequant-wasm:** Version, API (ImageQuantizer, setQuality, quantizeImage, encode_palette_to_png, free). Check for known issues (e.g. memory leaks, thread safety in worker).
- [ ] **resvg / SVGO:** Resvg for rasterization; SVGO for SVG optimization. Confirm SVGO config (`multipass: true`, `plugins: ['preset-default', 'removeDimensions']`) is documented and that `removeDimensions` is safe for all SVGs (e.g. responsive SVGs).

### 1.4 Configuration and baselines

- [ ] **expected.jsonc:** Single source of truth for size ceilings. Keys = filenames in test-images; values = format → size string (e.g. "26KB", "2MB"). E2E parses with `parseSize()`; tolerance 1.10× (or from size-overrides.jsonc). Verify parseSize handles "KB", "MB", "GB" and that "2MB" in expected.jsonc is correct (e.g. png-3.png).
- [ ] **quality-thresholds.jsonc:** Per-file/per-format overrides for SSIM/PSNR. Currently only comment; no entries. Quality gate also applies adaptive rules (palette vs truecolor, transparent+WebP). Document where those thresholds are defined (quality-gate.mjs).
- [ ] **size-overrides.jsonc:** Per-file/per-format size tolerance override. Empty in repo. Document that empty = 1.10× for all.

---

## Part 2 — Comparison to TinyPNG and 2026 Best Practices

Do not assume TinyPNG behavior. Look up: TinyPNG’s stated limits, formats, and quality approach (official site, blog, API docs). Then compare.

### 2.1 TinyPNG (verify from sources)

- [ ] **Formats:** TinyPNG: PNG and JPEG only (per public info). TinyJPG = JPEG. Confirm whether they support WebP/AVIF/SVG. If not, “parity” for WebP/AVIF means “industry best practice,” not “match TinyPNG.”
- [ ] **Limits:** Max file size (e.g. 5 MB free tier?), max dimensions. Document and compare to TinyIMG: MAX_FILE_SIZE = 25 MB, MAX_PIXELS = 256M.
- [ ] **Quality method:** Smart lossy + quantization. No public exact parameters. Our doc (QUALITY-RESEARCH.md) cites Industrial Empathy for AVIF/WebP/JPEG equivalence. Verify that citation (AVIF 64, WebP 82 ≈ JPEG 80) is still current in 2026.
- [ ] **Output:** Do they preserve metadata (EXIF, ICC)? Do we? Document: worker does not pass through or strip metadata explicitly; browser decode/encode may drop it.

### 2.2 Format support matrix

- [ ] **Input formats (worker):** From code: PNG, JPEG, WebP, AVIF (via createImageBitmap), SVG (via text path). No BMP, TIFF, GIF (multi-frame). Document and compare to TinyPNG and to “production-grade” expectations (e.g. GIF support for thumbnails).
- [ ] **Output formats:** original, webp, avif, jpeg, png, svg (for SVG input: optimized SVG or wrapped raster). “original” means keep extension (jpg→jpeg for encoding). Document MIME types and file extensions used in download/ZIP.

### 2.3 Codec options (verify against library docs)

- [ ] **AVIF (@jsquash/avif):** Options used: quality, speed, subsample, chromaDeltaQ, enableSharpYUV, tune. Verify defaultOptions in meta.js and that our PRESETS use valid values. Check if lib supports aom/codec options beyond what we pass (e.g. tile columns/rows for speed).
- [ ] **WebP (@jsquash/webp):** quality, method, use_sharp_yuv. Verify method 4 vs 5 (effort) and that use_sharp_yuv is 0/1. Check for lossless and alpha options if we ever need them.
- [ ] **JPEG (MozJPEG via @jsquash/jpeg):** quality, progressive, trellis_*, chroma_subsample. MozJPEG chroma_subsample: 0 = 4:4:4, 1 = 4:2:0, 2 = 4:2:2. Worker uses 1 (photo) and 0 (graphic). Confirm in library source.
- [ ] **PNG (oxipng via @jsquash/oxipng):** level 2 vs 4, interlace: false, optimiseAlpha. Verify level range and that optimiseAlpha is correct (British spelling in lib).

### 2.4 Quality and size targets

- [ ] **Design doc:** DESIGN-perfect-optimizer.md claims quality par or better (SSIM ≥ 0.98, PSNR ≥ 30 dB) and size ≤ baseline × 1.10. Baseline = expected.jsonc = “TinyPNG reference” (or our reference run). Verify: expected.jsonc values — are they from TinyPNG or from a prior TinyIMG run? If from TinyPNG, document how they were obtained (manual upload? API?).
- [ ] **Industrial Empathy table:** QUALITY-RESEARCH.md cites JPEG 80 → AVIF 64, WebP 82. Worker uses AVIF 55/56, WebP 72/74, JPEG 74/76 (lower than 80). Document whether this is intentional (smaller size, acceptable quality) and whether it still meets “visually lossless” or “TinyPNG-like” in practice.

### 2.5 Dependencies: versions, CVEs, and lifecycle

- [ ] **npm audit / bun audit:** Run `npm audit` or `bun audit` from project root. List any high/critical findings; document dev vs prod dependency exposure (e.g. sharp only in Node scripts, not in browser bundle).
- [ ] **Lockfile:** Repo has bun.lock. Confirm lockfile is committed and that CI uses it for reproducible builds. Document package manager (bun vs npm) for contributors.
- [ ] **@jsquash lifecycle:** Check GitHub/NPM for @jsquash/*: last publish dates, open issues (encode quality/size/crashes), and upstream codec versions (libavif, libwebp, MozJPEG, oxipng) if visible.
- [ ] **libimagequant-wasm:** Check for memory/correctness issues and whether it tracks upstream pngquant/libimagequant. Document version and known limitations.
- [ ] **resvg / SVGO:** Check security advisories (e.g. SVG parsing) and that versions in use are current or have a documented pin reason.

---

## Part 3 — Findings: Correctness

For each item: **Finding** | **Impact** | **Recommendation** (with source/justification where applicable).

### 3.1 Worker and encoding

- [ ] **F1 — Normalize format "jpg" vs "jpeg":** Worker uses `normalizeOutputFormat`; queue sends `format` from UI (e.g. "jpeg"). Confirm UI always sends "jpeg" for JPEG output and that no path sends "jpg" for encoding (would lib accept "jpg"?). Recommend: single canonical "jpeg" in types and options.
- [ ] **F2 — Blob type for JPEG:** Result Blob uses `type: 'image/jpeg'` when effectiveFormat === 'jpeg'. Confirm; recommend explicit `image/jpeg` for both jpeg and jpg extension in download filename.
- [ ] **F3 — SVG internal format default:** When `options.svgInternalFormat` is missing, worker uses `options.svgInternalFormat || 'webp'`. Queue always passes `svgInternalFormat` from GlobalOptions. Verify default in queue-processor (svgInternalFormat: 'webp') and that worker default is consistent.
- [ ] **F4 — toBase64 chunk size:** toBase64 uses chunk size 8192 and `String.fromCharCode(...chunk)`. For very large buffers, spread can hit engine limits. Recommend: verify max SVG raster size in practice; if needed, use larger chunk or binary-to-base64 in smaller chunks without spread (e.g. loop with subarray).
- [ ] **F5 — Timeout and double response:** If task throws after timeout fired, we clear timeout and post error; if timedOut we return without posting again. Verify there is no path that posts twice (success then error or vice versa). Recommend: single postMessage per task (success or error) and idempotent handling in main thread.
- [ ] **F6 — PNG quantizer free:** In PNG branches we call `res.free()` and `quantizer.free()`. Confirm all code paths (including early throw) free resources. Recommend: use try/finally for quantizer and result.
- [ ] **F7 — createImageBitmap options:** We do not pass options (e.g. premultiplyAlpha, colorSpaceConversion). Document default behavior; if we need sRGB/linear or alpha handling for correctness, add options per spec (MDN, W3C).

### 3.2 Queue and UI

- [ ] **F8 — getFormatsToProcess with useOriginalFormats:** When true, we use `item.originalFormat` (from file name extension). For "jpg" we normalize to "jpeg" in worker; here we push "jpeg" only if we map jpg→jpeg. Verify: createItem has originalFormat from `file.name.split('.').pop()`, so "image.jpg" → "jpg". getFormatsToProcess returns `[item.originalFormat === 'jpg' ? 'jpeg' : item.originalFormat]`. So we send one format "jpeg". Worker receives format "jpeg". Correct.
- [ ] **F9 — Multiple formats per file:** When useOriginalFormats is false, options.formats can be multiple. Each format becomes one task. Worker runs one format per message. Verify that result key is `format` (requested), and that UI displays all requested formats. Confirm no mix-up between label and format in display.
- [ ] **F10 — ZIP getMimeType:** In handleZip we set File type from getMimeType(fileName). If extension is not in the list we get application/octet-stream and then `if (f.type !== 'application/octet-stream')` we add the item. So we skip unknown extensions inside ZIP. Document; recommend explicitly listing allowed extensions for ZIP contents (same as isValidType) for clarity.

### 3.3 Quality gates and E2E

- [ ] **F11 — quality-gate.mjs ssim API:** Uses `const { ssim } = require('ssim.js'); ssim(orig, opt).mssim`. quality-gate-svg.mjs uses `import ssim from 'ssim.js'; ssim(refPixels, optPixels).mssim`. Verify ssim.js exports (default vs named) so both scripts run. Check ssim.js dist (main vs browser); Node runs main. Recommend: use same import style and verify in CI.
- [ ] **F12 — PSNR formula:** quality-gate.mjs computes PSNR from MSE over all channels. Standard is per-channel or luminance. Document choice; if comparing to papers, ensure same formula (e.g. 10*log10(255^2/MSE) with MSE over all pixels).
- [ ] **F13 — E2E export and filenames:** Export uses `base = path.basename(filename, path.extname(filename))` and `outPath = ${base}.${ext}`. For "png-1.png" → "png-1.webp", etc. Quality gate collects pairs by basename and extension. Verify that expected.jsonc keys match filenames and that format in expected matches extension (webp, avif, jpeg, png). png-3 has "2MB" for png; confirm parseSize("2MB") returns 2*1024*1024.
- [ ] **F14 — Adaptive thresholds:** Palette vs truecolor (SSIM ≥ 0.35, PSNR ≥ 12) and transparent+WebP (0.80, 19) are empirical. QUALITY-RESEARCH.md says so. Recommend: add a one-line reference or “tunable” note next to each; consider making them configurable via quality-thresholds.jsonc.

### 3.4 SVG path

- [ ] **F15 — Resvg 2× width:** Worker uses `fitTo: { mode: 'width', value: width * 2 }`. So we rasterize at 2× for classification and for embed. Quality-gate-svg also rasterizes at 2×. Consistent. Document that 2× is the “reference scale” for SVG quality.
- [ ] **F16 — Wrapper vs optimized size:** We compare wrapperSize to optimizedSvgSize * 0.95. If wrapper is smaller we use wrapper. Else we use optimized SVG. Recommend: document that 0.95 is a heuristic; consider making it a constant (e.g. WRAPPER_SIZE_THRESHOLD = 0.95).

---

## Part 4 — Findings: Performance

- [ ] **P1 — Concurrency cap:** maxConcurrency = min(max(hardwareConcurrency, 2), 6). Document: 2–6 workers. For many small images, task queue can have many tasks; for few large images, memory = files + decoded bitmaps in workers. Recommend: consider per-worker memory budget or max total decoded pixels across workers (e.g. 4 × 256M = 1G pixels total?).
- [ ] **P2 — Classification cost:** classifyContent samples pixels with step when totalPx > MAX_PIXELS_FOR_CLASSIFY (4M). Single pass over ImageData. For 4K image (~8.3M px) we sample. Recommend: measure time for 10M px image; if significant, consider Web Worker for classification only (currently same worker does decode+classify+encode).
- [ ] **P3 — WASM init:** Resvg and libimagequant init on first use (ensureResvg, ensureQuant). No preload. First SVG and first PNG optimization pay init cost. Recommend: document; optionally preload both in first idle or on first drop.
- [ ] **P4 — Large file in ZIP:** handleZip reads entire ZIP into memory (FileReader.readAsArrayBuffer). Then unzip. For 25 MB ZIP with many images, memory spikes. Recommend: document limit; consider streaming unzip or limiting ZIP size separately.
- [ ] **P5 — downloadAll ZIP:** Builds entire ZIP in memory (zipData object with Uint8Arrays). For many/large results, can OOM. Recommend: cap number of files or total size, or stream ZIP (if fflate supports it).

---

## Part 5 — Findings: Features and Gaps

- [ ] **G1 — No server/CLI:** Optimization is browser-only. No Node/Bun script that runs the same pipeline for CI or batch. Quality gates use sharp (Node) for decode and ssim.js; worker uses browser decode + WASM. So “in-browser artifact” is the only thing we validate. Recommend: document as intentional; if “production” includes server-side batch, add a separate Node path (e.g. sharp + same presets) or document that production = browser-only.
- [ ] **G2 — No EXIF/ICC handling:** We do not preserve or strip metadata. Browser decode may drop EXIF; encoder may not write it. Document; if “production” requires metadata handling, add explicit strip or pass-through (would require different pipeline).
- [ ] **G3 — No GIF/APNG/BMP/TIFF:** Only formats supported by createImageBitmap + SVG. Document; recommend listing supported input formats in README and UI (e.g. “PNG, JPEG, WebP, AVIF, SVG”).
- [x] **G4 — URL fetch proxy:** ~~addUrls() / proxyUrl~~ **Removed** (2026-03-25). No remote URL ingestion; static app only.
- [ ] **G5 — No retry:** On encode failure we post error and do not retry with different preset or lower quality. Recommend: document; optional future: one retry with photo preset.
- [ ] **G6 — No progress within task:** We have per-item progress (pending → processing → success/error) but no “50% encoded” within a single task. For very large images, user sees no progress for up to 120s. Recommend: document; optional: encoder progress callbacks if libs support.

---

## Part 6 — Findings: Reliability and Resilience

- [ ] **R1 — Task timeout 120s:** TASK_TIMEOUT_MS = 120_000. Worker does not abort encode; it only posts error after 120s. Encode continues until done or throw. Recommend: consider AbortController for createImageBitmap and encode if libs support it; otherwise document that timeout only prevents hung response, not CPU use.
- [ ] **R2 — Worker crash:** If worker throws uncaught, main thread may not get message. handleWorkerMessage only handles onmessage. Recommend: add worker.onerror and mark item/format as error; optionally restart worker.
- [ ] **R3 — updateOptions clears results:** updateOptions() clears all results and re-queues all items. If user toggles format list often, many redundant tasks. Recommend: document; optional: debounce or only re-queue affected formats.
- [ ] **R4 — No persistence:** Refresh loses queue and results. Document; optional: persist queue to sessionStorage (with size limits).

---

## Part 7 — Findings: Security

- [x] **S1 — Proxy SSRF:** **Resolved** by removing addUrls and the Cloudflare image proxy.
- [ ] **S2 — File type validation:** We validate by extension (isValidType) and MIME in ZIP (getMimeType). We do not validate magic bytes. Malicious file with wrong extension could be sent to worker; createImageBitmap may fail or decode unexpectedly. Recommend: add magic-byte check for allowed types before adding to queue (or document as accepted risk for client-only app).
- [ ] **S3 — SVG XSS:** SVG from user is parsed by Resvg and SVGO; optimized or wrapped SVG is shown/downloaded. If UI ever renders user SVG inline, XSS is possible. Confirm: we do not set innerHTML with user SVG in UI; we only pass to worker and offer download. Document.
- [ ] **S4 — No rate limit:** Client-side only; no rate limit on encode. Document; not a server concern.

---

## Part 8 — Findings: Observability and Deployment

- [ ] **O1 — No metrics:** No telemetry, no timing logs, no error reporting. Recommend: add optional performance marks (decode, classify, encode per format) and console or export for debugging; consider error reporting (e.g. Sentry) for production.
- [ ] **O2 — No health check:** No endpoint or flag for “worker and WASM loaded.” Recommend: document; optional: a minimal “smoke” E2E that runs one small image and asserts success.
- [x] **O3 — Deployment:** README and `CLOUDFLARE-DEPLOYMENT.md` describe static deploy; no proxy.
- [ ] **O4 — CI:** test:full runs E2E then quality gates. E2E needs browser (Playwright). Document Node version and Playwright install; recommend pinning Node in CI and caching Playwright browsers.

---

## Part 9 — Prioritized Summary and Action Plan

After completing Parts 1–8, fill this section.

### Critical (correctness / security / data loss)

- List findings that can cause wrong output, security incident, or data loss. Example: “F5 — toBase64 may throw on very large SVG raster” if confirmed.
- For each: one-line recommendation and owner (e.g. “Fix in worker; add chunked base64 without spread”).

### High (reliability / parity / main flows)

- Findings that affect reliability or TinyPNG parity (e.g. wrong codec option, missing format, quality gate false pass/fail).
- Recommendations with pointers to code and, if applicable, to 2026 docs or benchmarks.

### Medium (performance / UX / maintainability)

- Performance risks, missing progress, or tech debt that makes tuning hard.
- Short recommendations.

### Low (docs / optional features)

- Gaps in documentation, optional retry, or observability.
- Recommendations for docs or backlog.

---

## Part 10 — Verification Checklist (Before Sign-Off)

- [ ] All entry points and config sources traced and documented.
- [ ] TinyPNG comparison based on current (2026) public info and our expected.jsonc source.
- [ ] Every @jsquash / libimagequant / resvg option used has been checked against library source or official docs.
- [ ] quality-gate.mjs and quality-gate-svg.mjs run successfully with current test-images and test-output; ssim.js import verified.
- [ ] E2E parseSize and expected.jsonc format (e.g. "2MB") verified; size tolerance 1.10 applied consistently.
- [ ] No finding is “consider X” without a concrete recommendation (fix, config, or “document as intentional”).
- [ ] All recommendations that cite “industry standard” or “2026” have a stated source (doc URL, version, or “verified as of YYYY-MM”).

---

## Document control

- **Version:** 1.0
- **Created:** 2026-03-16
- **Purpose:** Execute this plan as the audit; output is a separate “AUDIT-REPORT” with the same structure (Parts 3–9 filled with verified findings and recommendations). Do not assume; verify every checkbox and finding with code or external sources.
