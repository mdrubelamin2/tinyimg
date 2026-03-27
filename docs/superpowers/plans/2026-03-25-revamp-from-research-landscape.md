# TinyIMG Revamp — Implementation Plan (from `image_optimization_landscape_2026.md`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the strategic revamp described in `docs/image_optimization_landscape_2026.md`: differentiate on privacy + batch + formats + UX (quality, preview, resize) without abandoning the jsquash-centric architecture or adding a server.

**Architecture:** Keep **jSquash** as the primary codec layer; extend `optimizer.worker.ts` / `raster-encode.ts` with new codecs and decode paths; route UX through `QueueProcessor` → worker pool per `docs/IMPLEMENTATION-MAP.md`. Prefer **pica + Canvas** for resize (not wasm-vips). Add JXL and Jpegli via `@jsquash/jxl` / libjxl-derived WASM when packages and APIs are verified for the build.

**Tech Stack:** TypeScript, Vite 8, React 19, Vitest, Playwright, existing `@jsquash/*`, `pica`, `svgo`, `resvg-wasm`.

**Related docs:** `docs/image_optimization_landscape_2026.md` (research), `docs/IMPLEMENTATION-MAP.md` (boundaries), `docs/ACCEPTANCE-CRITERIA.md` (regression bar), `docs/superpowers/plans/2026-03-25-production-refactor.md` (foundation refactor — complete or reconcile before large feature work).

---

## Phase 0 — Preconditions & guardrails

- [ ] **Step 0.1:** Confirm production-refactor plan status (queue split, URL removal). Large UX features should sit on stable `QueueProcessor` / worker contracts.
- [ ] **Step 0.2:** Re-read `docs/ACCEPTANCE-CRITERIA.md` and extend it with acceptance criteria for any new output format (JXL, new inputs) before implementation.

Run after each phase:

```bash
npm run typecheck && npm run test && npm run test:e2e
```

Expected: all pass (adjust E2E/quality gates when new formats are added).

---

## Phase 1 — Quick wins (bundle, maintainability, UX baseline)

### Task 1.1: Remove unused `canvg`

**Files:**
- Modify: `package.json` (remove `canvg` dependency)
- Verify: `grep -r canvg src` → no matches (already true per audit)

- [ ] **Step 1:** Remove `canvg` from `dependencies` in `package.json`.
- [ ] **Step 2:** Run `npm install` and `npm run build`.
- [ ] **Step 3:** Commit: `chore: remove unused canvg dependency`.

### Task 1.2: Extract encoder presets to config

**Files:**
- Create: `src/config/encoder-presets.ts` (or align with `docs/PRESET-CONFIG-REVIEW.md` if exists)
- Modify: `src/workers/raster-encode.ts`, `src/constants.ts` — import presets; avoid duplicate literals

- [ ] **Step 1:** Identify hardcoded quality/method values in `raster-encode.ts` and related worker modules.
- [ ] **Step 2:** Move to typed preset objects; keep `constants.ts` re-exporting only what UI needs.
- [ ] **Step 3:** Add/adjust unit tests in `src/tests/` for preset selection paths.
- [ ] **Step 4:** Commit: `refactor: centralize encoder presets`.

### Task 1.3: Dark mode (if not present)

**Files:**
- Modify: `index.html`, `src/App.tsx` or root layout, Tailwind theme in `src/index.css` or equivalent

- [ ] **Step 1:** Add `class`-based dark variant (or CSS variables) consistent with existing Tailwind 4 setup.
- [ ] **Step 2:** Persist preference (`localStorage`) optional per product decision.
- [ ] **Step 3:** Smoke E2E: `npm run test:e2e`.

---

## Phase 2 — Cancellation & queue UX

### Task 2.1: Worker cancellation (`AbortController`)

**Files:**
- Modify: `src/lib/worker-pool.ts` — support abort per task id
- Modify: `src/lib/queue-processor.ts` — expose cancel API
- Modify: `src/workers/optimizer.worker.ts` — listen for abort / teardown WASM work where possible

- [ ] **Step 1:** Design message shape: `{ type: 'abort', id }` from main to worker; worker clears timeout and rejects ongoing work.
- [ ] **Step 2:** Wire `QueueProcessor` method (e.g. `cancelItem(id)`) to pool.
- [ ] **Step 3:** Unit tests for pool + integration test with mocked worker.
- [ ] **Step 4:** Commit: `feat: cancel in-flight optimization tasks`.

### Task 2.2: Optional priority queue (small files first)

**Files:**
- Modify: `src/lib/queue/queue-scheduler.ts` or scheduling logic inside `queue-processor.ts` (match actual file after refactor)

- [ ] **Step 1:** Sort pending queue by `file.size` ascending before dispatch (feature-flag or setting).
- [ ] **Step 2:** Test: order of completion for synthetic files.

---

## Phase 3 — Input format expansion (decode-only)

**Goal:** GIF, BMP, TIFF, HEIC where browser/WASM decode exists — align with landscape §7 Priority 1.

**Files:**
- Modify: `src/lib/validation.ts` — magic bytes / MIME
- Modify: `src/workers/raster-encode.ts` / decode path — `createImageBitmap` or new decoders
- Modify: `src/constants.ts` — `SUPPORTED_INPUT` extensions, error messages
- Modify: `src/components/Dropzone.tsx` — accept filters

- [ ] **Step 1:** Per format, spike decode in worker: prefer native `createImageBitmap` when supported; document fallbacks.
- [ ] **Step 2:** GIF: decode first frame (explicitly document no animation in v1 per landscape “What NOT to Do”).
- [ ] **Step 3:** Add Vitest/fixtures for smallest valid files per type.
- [ ] **Step 4:** Update `docs/image_optimization_landscape_2026.md` Appendix B “Our Status” or README.

---

## Phase 4 — JPEG XL + Jpegli (differentiation)

**Risk:** Package maturity, bundle size, encode API differences from MozJPEG.

### Task 4.1: JPEG XL output (experimental)

**Files:**
- Modify: `package.json` — add `@jsquash/jxl` when validated
- Modify: `src/workers/optimizer-wasm.ts` or new `jxl-encode.ts` module
- Modify: `src/constants.ts` — `OutputFormat` includes `'jxl'` behind feature or stable
- Modify: `src/components/ConfigPanel.tsx` — output selector + “experimental” label if needed

- [ ] **Step 1:** Verify `@jsquash/jxl` version, WASM load path, and `WebAssembly.compileStreaming` compatibility with Vite.
- [ ] **Step 2:** Implement encode path from `ImageData` after existing decode/classify.
- [ ] **Step 3:** Lazy `import()` so non-JXL users pay no cost.
- [ ] **Step 4:** Quality gate: add golden or SSIM threshold for JXL sample in `test-images/`.

### Task 4.2: Jpegli as primary JPEG encoder (MozJPEG fallback)

**Files:**
- Modify: `raster-encode.ts` — branch encoder; keep `@jsquash/jpeg` as fallback
- Document: bundle impact of shipping both

- [ ] **Step 1:** Confirm WASM build source (libjxl/jpegli) and licensing.
- [ ] **Step 2:** A/B size vs MozJPEG on `test-images` JPEGs; document in `docs/QUALITY-RESEARCH.md` or similar.
- [ ] **Step 3:** Feature flag or automatic fallback on encode error.

---

## Phase 5 — User power: quality, preview, resize

### Task 5.1: Quality slider (global → per-image)

**Files:**
- Modify: `src/constants.ts` — `GlobalOptions` quality 0–100 or per-format map
- Modify: `src/components/ConfigPanel.tsx` — sliders
- Modify: `src/workers/raster-encode.ts` — map slider to codec params

- [ ] **Step 1:** Define mapping functions per codec (WebP, AVIF, JPEG, PNG quant).
- [ ] **Step 2:** Tests: extreme values don’t throw; middle matches prior preset behavior when “default”.

### Task 5.2: Before/after preview

**Files:**
- Create: `src/components/ComparePreview.tsx` (or split-view in results)
- Modify: `src/lib/queue-types.ts` — retain object URLs for original vs result blobs as needed

- [ ] **Step 1:** For single-item focus: side-by-side or slider (landscape §7 Priority 4).
- [ ] **Step 2:** Performance: don’t decode full batch previews; on-demand.

### Task 5.3: Resize / crop (pica + Canvas)

**Files:**
- Modify: worker pipeline — resize after decode, before encode; reuse `pica` (`package.json` already includes it)
- Modify: UI — dimensions, “max edge”, aspect lock

- [ ] **Step 3:** Document interaction with SVG raster pipeline (resize bitmap vs SVG viewport — separate decision).

### Task 5.4: Metadata controls (EXIF/ICC strip)

**Files:**
- Modify: encode paths — strip or preserve per option; verify what jsquash exposes

---

## Phase 6 — SVG performance (svgtidy evaluation)

**Files:**
- Modify: `src/workers/svg-pipeline.ts`
- Optional: new WASM wrapper module

- [ ] **Step 1:** Benchmark SVGO vs svgtidy on representative SVGs from `test-images` or fixtures.
- [ ] **Step 2:** If svgtidy: dual path with SVGO fallback on failure or unsupported features.
- [ ] **Step 3:** Update docs on plugin parity limits.

---

## Phase 7 — WASM loading & performance polish

**Files:**
- Modify: codec load sites — `WebAssembly.compileStreaming` + `fetch` to same-origin WASM URLs
- Modify: `vite.config.ts` if asset handling needed

- [ ] **Step 1:** Measure cold start before/after on throttled network (Playwright or manual).
- [ ] **Step 2:** Optional preload of codecs based on selected output formats.

---

## Explicit non-goals (from landscape doc)

Do **not** implement unless product direction changes:

- Server-side processing or upload
- FFmpeg.wasm as main pipeline
- wasm-vips as default engine (4.6MB+)
- Animated WebP/AVIF in v1
- “AI compression” marketing features without technical basis

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-03-25-revamp-from-research-landscape.md`.

**Options:**

1. **Subagent-driven** — `@superpowers:subagent-driven-development` per task.
2. **Inline** — `@superpowers:executing-plans` in this session with checkpoints.

Choose based on how much review you want between phases.
