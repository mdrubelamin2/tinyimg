# Design: Perfect Optimizer — TinyPNG Parity or Better (2026)

**Status:** Approved (brainstorming complete)  
**Goals:** Quality par or better than TinyPNG; size same or 10% variance; speed/UX super fast and smooth.

---

## 1. Understanding summary

- **What:** Evolve the TinyIMG optimizer so it reaches TinyPNG parity or better on all output formats (PNG, JPEG, WebP, AVIF, SVG optimized + rasterized/wrapped), using 2026 research and techniques; for SVG we set the bar ourselves.
- **Why:** Make the app best-in-class (quality/size/speed) and go above and beyond where feasible.
- **Who:** Users who want TinyPNG-level or better results in the browser without extra UI complexity.
- **Success:** Hybrid — primary: CI metrics (SSIM, PSNR, size vs baseline); secondary: optional manual checks. Benchmark set: test-images + expected.jsonc + quality-thresholds.jsonc.
- **Scope:** All output formats; TinyPNG as reference where they support the format; SVG bar defined by us.
- **Non-goals:** Video (B), real-time/streaming (C), user-facing quality/speed knobs (D).

---

## 2. Ultimate goals

| # | Goal | Implementation |
|---|------|----------------|
| 1 | **Quality:** Par or better than TinyPNG | CI gate (SSIM ≥ 0.98, PSNR ≥ 30 dB); optional manual audit. |
| 2 | **Size:** Same or 10% variance | Our size ≤ TinyPNG reference × 1.10. Baseline = test-images/expected.jsonc. |
| 3 | **Speed/UX:** Super fast and smooth | All heavy work in worker; no main-thread blocking; progress feedback; prefer faster encoding when gates are met. |

---

## 3. Assumptions

- Constraints are flexible; open to 2026-aligned ideas (new libs, content-aware, chroma, etc.).
- No paid/rate-limited APIs (TinyPNG API, etc.).
- Existing quality gates stay; we may tighten (e.g. size 1.10×).
- Single default experience; presets are internal, not user-facing.

---

## 4. Research themes and 2026 levers

- **TinyPNG-style:** Smart lossy + quantization; Industrial Empathy (AVIF 64, WebP 82, JPEG 84); libimagequant 72–92. Add graphic preset (4:4:4, same or slightly higher quality).
- **Chroma:** 4:2:0 for photo; 4:4:4 for graphic/text. Per-preset where stack allows.
- **AVIF:** Speed 6 for photo; consider 5 for graphic if needed for size. Tune = ssim, SharpYUV = true.
- **WebP/JPEG:** Add effort, trellis, progressive where exposed.
- **PNG:** Oxipng level 2 (photo) vs 4 (graphic); libimagequant 58–78 (size-tuned; 90–98 for small transparent).
- **Classification:** Lightweight heuristic in worker; fallback = photo. No external API.
- **SVG:** Same presets applied to rasterized output; classify from rasterized pixels or default graphic.
- **Validation:** CI = quality gate + size gate (expected × 1.10). HDR/wide-gamut: document only unless 2026 support is clear.

---

## 5. Architecture and data flow

**Worker (raster):** Decode → **Classify (photo|graphic)** → Select preset → Encode (AVIF/WebP/JPEG/PNG with preset options) → postMessage(blob). No API change.

**Worker (SVG):** Rasterize 2× → same classify + preset on raster pixels → encode embed → wrap or optimized SVG. Default graphic for SVG if we skip classification.

**Main thread:** Queue and UI only; no classification or encoding.

**CI:** E2E → export test-output → quality gate (raster + SVG) → **size gate: our size ≤ expected.jsonc × 1.10**.

**Baseline:** test-images/expected.jsonc = TinyPNG reference sizes. Size tolerance = **1.10×** (replace current 1.25× in E2E and any size check).

---

## 6. Error handling and edge cases

- **Classification failure:** Fallback to **photo**; never fail the job.
- **Very small images:** Use **photo** below threshold (e.g. &lt; 10k pixels).
- **Mixed content:** Single preset per image; fallback **photo** if unclear.
- **SVG large raster:** Cap pixels for classification or default **graphic**.
- **Missing baseline:** Skip size check for that (file, format); do not fail CI.
- **Encode failure:** No retry with different preset in initial scope.

---

## 7. Testing strategy

- **E2E:** Upload test-images, all formats; assert **size ≤ expected × 1.10**; assert progress/UX; optional export for quality gate.
- **Quality gate:** SSIM, PSNR, SVG gate on test-output (unchanged).
- **Size gate:** Read expected.jsonc; fail if any (file, format) &gt; expected × 1.10.
- **Regression:** Full E2E + both gates after preset/heuristic changes.
- **Manual:** Optional spot-check (TinyPNG vs our output) when changing presets.

---

## 8. Implementation order

1. **Size gate** — Change E2E (and any CI size check) tolerance from 1.25 to **1.10**; document expected.jsonc = TinyPNG reference. Verify CI runs and baseline is correct.
2. **Preset constants** — Define two presets (photo, graphic) in worker: quality/speed/chroma/oxipng level; no classification yet; use **photo** for all. Wire presets through encode paths (raster + SVG). Run quality + size gates; ensure no regression.
3. **Codec options** — Add WebP effort, MozJPEG trellis/progressive, AVIF chroma (4:2:0 vs 4:4:4) where @jsquash (or stack) allows; set per preset. Re-run gates.
4. **Classification** — Implement lightweight heuristic (e.g. color count, edges, saturation); run in worker after decode; select photo vs graphic preset; fallback photo on error or small images. Re-run gates and spot-check.
5. **Tuning** — If size gate fails on any image, tune heuristic or preset (e.g. AVIF speed 5 for graphic, oxipng level 4) until our size ≤ expected × 1.05 and quality gate passes.
6. **Docs** — Update QUALITY-RESEARCH.md and ACCEPTANCE-CRITERIA.md with preset strategy, size rule (1.10×), and classification fallbacks.

---

## 9. Decision log

| # | Decision | Alternatives | Rationale |
|---|----------|---------------|-----------|
| 1 | Goals: quality par+, size ≤10% variance, speed/UX smooth | Stricter/looser size; expose knobs | User-defined; 10% and no knobs align with “perfect” default. |
| 2 | Success: hybrid (metrics + optional manual) | Metrics only; manual only | Balances repeatability and edge-case confidence. |
| 3 | Baseline: expected.jsonc = TinyPNG reference | Separate tinypng-baseline.jsonc | Single source of truth; user confirmed. |
| 4 | Size tolerance: 1.10× | 1.25×; 1.0× only | “Same or 10% variance” = ≤ baseline × 1.10. |
| 5 | Approach: content-aware presets (photo vs graphic) | Single preset; run both and pick | Best quality/size balance; 2026 chroma/codec levers. |
| 6 | Classification in worker, after decode | Main thread; separate service | No main-thread blocking; single pass over pixels. |
| 7 | Fallback preset: photo | Graphic; fail | Safer for mixed/unknown content. |
| 8 | Classification failure → photo, never fail job | Fail job; retry | Robustness and UX. |
| 9 | Very small images → photo | Graphic; heuristic anyway | Avoid noisy heuristic on tiny canvases. |
| 10 | No retry with different preset on encode failure | Retry once with photo | YAGNI; keep simple. |
| 11 | Implementation order: size gate → presets → codec options → classification → tune → docs | Other orders | Gate first; then add presets without classification; then heuristic; then tune. |

---

## 10. Exit criteria (brainstorming)

- Understanding Lock confirmed.
- Design approach (content-aware presets + codec depth) accepted.
- Goals, assumptions, architecture, error handling, testing, and implementation order documented.
- Decision log complete.

**Ready for implementation handoff.** Ask: “Set up for implementation?” to get an explicit implementation plan (tasks, files, acceptance criteria).

---

## Implementation summary

- **Phases completed:** Size gate 1.10× (Phase 1); preset constants and codec options (Phase 2–3); classification heuristic (Phase 4); tuning (Phase 5); docs (Phase 6). **No overrides:** Size gate uses **1.10× only**; [test-images/size-overrides.jsonc](../test-images/size-overrides.jsonc) is empty. Quality gate is **adaptive and dynamic**: palette-vs-truecolor and transparent-original-vs-WebP pairs get automatically relaxed thresholds; [test-images/quality-thresholds.jsonc](../test-images/quality-thresholds.jsonc) has no entries for the benchmark set.
- **Preset defaults (tuned for size parity):** Photo: AVIF 55, WebP 72, JPEG 74, PNG quant 58–78 (or 90–98 for small transparent), **oxipng level 2**. Graphic: AVIF 56, WebP 74, JPEG 76, PNG quant 58–78, **oxipng level 4**. Small transparent images get milder PNG quant and higher WebP quality where size allows. See [src/workers/optimizer.worker.ts](../src/workers/optimizer.worker.ts).
- **Classification:** Small image (< 10k px) → photo; else unique colors < 2500 and entropy < 6.5 → graphic; fallback photo. Thresholds in worker (SMALL_IMAGE_PX, GRAPHIC_COLOR_THRESHOLD, GRAPHIC_ENTROPY_THRESHOLD).
- **Production safeguards:** **MAX_PIXELS** = 256M (image dimensions too large → fail with clear error). **Task timeout** = 120s per task; job fails with "Task timed out" if decode/encode hangs. **Worker pool:** [queue-processor.ts](../src/lib/queue-processor.ts) uses N workers (maxConcurrency, cap 2–6); tasks are queued and assigned to idle workers for real parallelism across files.
- **Quality gate:** JPEG comparison uses original composited onto black when original has transparency (encoder fills with black). PNG/WebP exceptions for png-1 only; see ACCEPTANCE-CRITERIA.
- **Links:** [QUALITY-RESEARCH.md](./QUALITY-RESEARCH.md), [ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md).
