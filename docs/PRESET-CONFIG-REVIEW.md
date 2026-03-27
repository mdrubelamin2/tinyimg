# Preset configuration review (2026-aligned)

**Scope:** PRESETS and related constants in `src/workers/optimizer.worker.ts`, quality/size gates, expected baselines, design doc.  
**Criteria:** Optimal balance of quality, size, and speed; industry standards and 2026 best practices.

---

## Verdict

The preset configuration is **intentionally size-tuned below** the industry-standard “JPEG-80 parity” values (AVIF 64, WebP 82, JPEG 84, PNG quant 72–92) so that output stays within **size ≤ expected × 1.10** while still targeting **SSIM ≥ 0.98, PSNR ≥ 30 dB**. For that goal it is coherent and well-structured (content-aware presets, chroma 4:2:0 vs 4:4:4, oxipng 2 vs 4, trellis/progressive, SharpYUV, AVIF tune ssim). It is **not** fully aligned with 2026-documented “chosen constants” or with a strict interpretation of Industrial Empathy defaults, because the codebase explicitly favors size parity over quality parity. The following changes bring documentation and one preset choice in line with 2026 standards and best practice without relaxing the size gate.

---

## Concrete, actionable changes

| # | File | Symbol / location | Current value | Recommended value | Reason | Source |
|---|------|-------------------|----------------|-------------------|--------|--------|
| 1 | `src/workers/optimizer.worker.ts` | `PRESETS.graphic.avif.speed` | `6` | `5` | Design doc §4: “consider 5 for graphic if needed for size.” Speed 5 improves compression for graphic AVIF at modest CPU cost; keeps quality/size balance and aligns with design. | DESIGN-perfect-optimizer.md §4 |
| 2 | `docs/QUALITY-RESEARCH.md` | “Chosen Constants” section | Table only: AVIF 64, WebP 82, JPEG 84, PNG 72/92 | Add a second table or subsection: **“Size-tuned defaults (current worker)”** with AVIF 55/56, WebP 72/74, JPEG 74/76, PNG quant 58–78 (90–98 small transparent). State that these are below Industrial Empathy to meet size ≤ baseline × 1.10 and that CI quality gate (SSIM ≥ 0.98, PSNR ≥ 30 dB) must pass. | Avoids reader/auditor mismatch: doc says 64/82/84 but code uses 55/72/74; 2026 alignment = document actual policy. |
| 3 | `docs/DESIGN-perfect-optimizer.md` | §4 Research themes, PNG bullet | “libimagequant 72–92 unchanged” | “libimagequant 58–78 (size-tuned; 90–98 for small transparent); oxipng level 2 (photo) vs 4 (graphic).” | Implementation uses 58–78 and 90–98; section 4 should match so research themes = implementation. | DESIGN §4 vs implementation summary |
| 4 | `src/workers/optimizer.worker.ts` | `PRESETS.photo.png.quantMin`, `PRESETS.graphic.png.quantMin` | `58` | **Optional:** `62` or `65` | QUALITY-RESEARCH: “min 72 reduces banding”; 58 is more aggressive. If quality gate or manual review ever shows banding on palette PNG, raise quantMin toward 62–65 as a safer floor while still below 72. No change if gate and visuals are acceptable. | QUALITY-RESEARCH.md “min 72 reduces banding” |

---

## What was left unchanged (and why)

- **AVIF/WebP/JPEG quality levels (55/56, 72/74, 74/76):** Deliberately below Industrial Empathy 64/82/84 to meet the 1.10× size ceiling. Raising them would improve 2026 “parity” wording but risk failing the size gate; no change unless you relax size tolerance or re-baseline expected.jsonc.
- **TASK_TIMEOUT_MS (120_000), MAX_PIXELS (256_000_000), WRAPPER_SIZE_THRESHOLD (0.95):** Aligned with design and common practice; no change.
- **Classification thresholds (SMALL_IMAGE_PX 10_000, GRAPHIC_COLOR_THRESHOLD 2_500, GRAPHIC_ENTROPY_THRESHOLD 6.5, MAX_PIXELS_FOR_CLASSIFY 4_000_000, SMALL_TRANSPARENT_PX 800_000):** Heuristic-only; no industry standard. Values are consistent and documented; no change.
- **quality-thresholds.jsonc / size-overrides.jsonc:** Empty with correct comments and default behavior (1.10×, 0.98/30 dB); no change.
- **expected.jsonc:** Baseline; only update when re-running reference or changing presets per ACCEPTANCE-CRITERIA.

---

## Summary

- **Apply:** (1) graphic AVIF `speed` 6 → 5 in `optimizer.worker.ts`; (2) document size-tuned defaults in QUALITY-RESEARCH; (3) fix DESIGN §4 PNG wording.
- **Optional:** If banding appears, raise PNG quantMin 58 → 62 or 65.
- **Do not modify:** queue-processor.ts, ConfigPanel.tsx, or E2E tests for these changes.
