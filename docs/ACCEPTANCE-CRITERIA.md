# Acceptance Criteria: TinyPNG Quality Completion (2026)

"Done" for TinyPNG parity is defined below. All criteria apply to **default app behavior** (no user config; worker quality constants as in the codebase). Validation uses **in-browser E2E** to produce optimized artifacts, then **Node scripts** run perceptual and size gates on those artifacts. No deferrals: SVG perceptual, second metric, in-browser artifacts, and content-adaptive thresholds are all in scope.

---

## Primary Gate: Perceptual Quality

- **Scope:** (1) **Raster → raster:** PNG, JPEG, WebP, AVIF in → same or other raster out. (2) **SVG:** Original SVG rasterized at 2× vs optimized output (wrapped SVG embed or rasterized optimized SVG); see SVG gate below.
- **Metrics:** Two metrics; both must pass. (1) **SSIM** (via **ssim.js**). Threshold: **SSIM ≥ 0.98** (or optional per-file override in [test-images/quality-thresholds.jsonc](../test-images/quality-thresholds.jsonc)). (2) **PSNR** (second metric). Threshold: **PSNR ≥ 30 dB**. Defaults are 0.98 and 30 dB. The gate is **adaptive and dynamic**: when the original has &gt;256 colors and the optimized image has ≤256 (palette vs truecolor), thresholds are relaxed automatically; when the original has transparency and the optimized format is WebP, thresholds are relaxed automatically. No per-file entries are required for the benchmark set. See [QUALITY-RESEARCH.md](./QUALITY-RESEARCH.md).
- **How:** Artifacts are produced by **in-browser E2E** ([src/tests/e2e/benchmarking.spec.ts](../src/tests/e2e/benchmarking.spec.ts)): each optimized file is downloaded and saved to `test-output/`. Then **Node** scripts run on the same small set (test-images/ originals, test-output/ optimized): `scripts/quality-gate.mjs` (raster pairs: decode to pixels, run SSIM + PSNR); `scripts/quality-gate-svg.mjs` (SVG originals: rasterize at 2× with resvg, compare to optimized output). Fail if any pair is below threshold.
- **When:** Run in CI after E2E. npm script: `test:quality` (runs both raster and SVG gates with `test-images` and `test-output`). **CI sequence:** Run `npm run test:e2e` first (Playwright exports to `test-output/`), then `npm run test:quality`; or use `npm run test:full` to run both in order.

**If the perceptual gate fails:** Inspect the reported image(s), SSIM and PSNR values. Adjust worker constants in [src/workers/optimizer.worker.ts](../src/workers/optimizer.worker.ts), add overrides in [test-images/quality-thresholds.jsonc](../test-images/quality-thresholds.jsonc), or add a regression test image.

---

## Secondary Gate: Size

- **Source of truth:** [test-images/expected.jsonc](../test-images/expected.jsonc) only (no second expected file). This file holds TinyPNG reference sizes.
- **Rule:** Optimized file size must be **≤ baseline × tolerance**. Baselines come from TinyPNG reference (or our quality-mode reference run). Tolerance: **1.10×** (10% variance; implemented in E2E; see [benchmarking.spec.ts](../src/tests/e2e/benchmarking.spec.ts)). In normal operation **no size-overrides** are used; [test-images/size-overrides.jsonc](../test-images/size-overrides.jsonc) is empty.
- **E2E:** [src/tests/e2e/benchmarking.spec.ts](../src/tests/e2e/benchmarking.spec.ts) reads expected.jsonc and applies 1.10 (or per-file/per-format override from [test-images/size-overrides.jsonc](../test-images/size-overrides.jsonc) if present). Do not relax default to 1.25.

---

## In Scope (No Defer)

All of the following are implemented; nothing is deferred.

- **Raster perceptual:** SSIM ≥ 0.98 and PSNR ≥ 30 dB (or per-file overrides in `quality-thresholds.jsonc`). Both metrics must pass.
- **SVG perceptual:** [scripts/quality-gate-svg.mjs](../scripts/quality-gate-svg.mjs) rasterizes original SVG at 2× (resvg), compares to optimized output (wrapped embed or rasterized optimized SVG). SSIM ≥ 0.98.
- **In-browser artifact validation:** E2E exports each optimized file to `test-output/`; the Node quality gates run on those artifacts so the validated output is produced by the real app in a browser.
- **Content-adaptive thresholds:** Global defaults (SSIM 0.98, PSNR 30 dB) plus optional per-file (and per-format) overrides in [test-images/quality-thresholds.jsonc](../test-images/quality-thresholds.jsonc). Schema: `"filename": { "ssimMin": number?, "psnrMin": number? }`.

---

## Multi-Agent Review (Historical: Out of Scope → In Scope)

**Note:** The four “out of scope” decisions above are now in scope and implemented (see “In Scope (No Defer)”).

### Skeptic / Challenger — Objections

- **O1 (SVG → SVG):** If we never run SSIM on SVG output, we might ship wrapped SVGs that look worse than the optimized SVG and only notice via user reports. “Optional manual/snapshot” is underspecified—who runs it and when?
- **O2 (Butteraugli / VMAF):** “Defer unless SSIM proves insufficient” has no trigger. If SSIM passes but users still report quality issues, we have no written criterion for when to add Butteraugli/VMAF, so the deferral may never be revisited.
- **O3 (In-browser tests):** Not requiring in-browser perceptual tests is a choice; the risk is that Node-based SSIM passes while the real browser pipeline (e.g. decode/display) introduces visible differences we don’t catch.
- **O4 (Content-adaptive thresholds):** A single global SSIM ≥ 0.98 might be too strict for some content (e.g. very noisy or synthetic images) and too loose for others (e.g. sharp text), leading to either flaky CI or undetected quality drops.

### Constraint Guardian — Objections

- **O5:** No objection. Keeping Butteraugli/VMAF and in-browser tests out of scope limits CI cost and complexity; single threshold reduces maintenance. The out-of-scope list is consistent with “minimal viable gate.”

### User Advocate — Objections

- **O6:** “Out of scope” is clear for implementers but could confuse readers: they might think SVG quality or in-browser behavior is “not important” rather than “not in this gate.” A one-line rationale per bullet would clarify (e.g. “SVG → SVG: no SSIM because comparison is vector vs vector or wrapped raster; size ceiling only”).

### Primary Designer — Responses

- **O1:** Accept. **Revision:** Add a short rationale: “SVG → SVG: no pixel-level comparison (vector or wrapped raster); size ceiling only. Optional manual/snapshot: run when changing SVG pipeline (e.g. resvg or SVGO version).”
- **O2:** Accept. **Revision:** Add trigger: “Revisit if SSIM gate passes but user reports or manual review show visible quality issues; then consider adding Butteraugli or a second metric.”
- **O3:** Acknowledge. No change to “not required”; document the risk in the rationale so we don’t forget: “In-browser perceptual tests: not required for CI; Node SSIM is the gate. If browser decode/display issues are reported, consider adding a visual check (e.g. screenshot diff) later.”
- **O4:** Accept. No change to single threshold for now (YAGNI); add: “If we see systematic false passes/failures by content type, revisit per-image or per-format thresholds.”
- **O5:** No change.
- **O6:** Accept. Add one-line rationale per out-of-scope item (see revisions above).

### Integrator / Arbiter — Resolutions

| # | Objection | Disposition | Rationale |
|---|-----------|-------------|-----------|
| O1 | SVG rationale / optional snapshot | **Accepted** | Clarify why no SSIM and when optional check runs. |
| O2 | Trigger for Butteraugli/VMAF | **Accepted** | Document when to revisit. |
| O3 | In-browser risk | **Accepted** | Document risk; no new requirement. |
| O4 | Content-adaptive | **Accepted** | Add “revisit if systematic by content type.” |
| O5 | — | **No change** | No violation. |
| O6 | Rationale per bullet | **Accepted** | One-line rationale per out-of-scope item. |

**Arbiter decision:** **APPROVED with revisions.** The out-of-scope list stands; the doc will be revised to add short rationales and revisit triggers so the decisions are traceable and maintainable.

### Decision Log (Out of Scope)

| Decision | Alternatives | Resolution |
|----------|---------------|------------|
| SVG → SVG: size only | Add pixel compare for wrapped SVG vs 2× raster | Keep size only; add rationale and when to run optional manual/snapshot. |
| Butteraugli / VMAF: defer | Add now | Keep defer; add trigger (user reports / manual review shows issues). |
| In-browser tests: not required | Require in CI | Keep not required; document risk (browser decode/display). |
| Single threshold 0.98 | Per-image or per-format thresholds | Keep single; add “revisit if systematic by content type.” |
