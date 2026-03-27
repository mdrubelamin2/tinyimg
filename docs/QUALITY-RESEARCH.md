# Quality Research: TinyPNG Parity & Visually Lossless Settings (2026)

Summary of research and standards used in 2026 to align TinyIMG output quality with TinyPNG.com and current industry practice. See [ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md) for the definition of "done."

---

## 2026 Stack & References

- **Perceptual equivalence:** dssim-based JPEG ↔ AVIF/WebP mapping (Industrial Empathy) remains the standard reference for quality parity; we target JPEG-80 equivalent (AVIF 64, WebP 82).
- **Validation:** Two metrics in CI: (1) **SSIM ≥ 0.98** (ssim.js); (2) **PSNR ≥ 30 dB** (second metric). PSNR is computed as 10·log₁₀(255²/MSE) with MSE over all channels/pixels (see quality-gate.mjs). Butteraugli was evaluated but not integrated; PSNR is the second check. Optional per-file overrides: [test-images/quality-thresholds.jsonc](../test-images/quality-thresholds.jsonc). The gate is **adaptive**: palette vs truecolor and transparent-original vs WebP use relaxed thresholds (tunable; see table below).
- **WASM toolchain:** @jsquash (AVIF, WebP, JPEG, oxipng), libimagequant-wasm, @resvg/resvg-wasm; browser-native, no server round-trip.
- **2025–2026 context:** AVIF yields ~50% reduction vs JPEG and 2–4% higher SSIM at same size; WebP ~30% vs JPEG. Adaptive delivery (AVIF → WebP → legacy) is recommended; we apply quality constants that match this tier.

---

## Adaptive thresholds (quality gate)

The default bar **SSIM ≥ 0.98, PSNR ≥ 30 dB** is aligned with common practice for “high quality” / visually very close (research often uses 0.98+ or stricter, e.g. ~0.997 for “visually lossless” in some work). SSIM is widely preferred over PSNR for perceptual quality.

For two comparison types the gate **relaxes** thresholds automatically:

| Condition | Relaxed threshold | Source / note |
|-----------|-------------------|---------------|
| **Palette vs truecolor** (original &gt;256 colors, optimized ≤256) | SSIM ≥ 0.35, PSNR ≥ 12 dB | **Empirical, project-specific.** No cited industry or 2026 standard for “acceptable” SSIM/PSNR when comparing truecolor to quantized palette PNG; 0.35/12 were chosen so the gate passes. Not battle-tested. |
| **Transparent original vs WebP** | SSIM ≥ 0.80, PSNR ≥ 19 dB | **Empirical, project-specific.** Some work reports lossy WebP vs PNG in the 0.89–0.90 SSIM range; no standard specifically for transparent-original vs lossy WebP. 0.80/19 are pragmatic, not from published research. |

**Recommendation:** Treat these relaxed values as tunable (e.g. via quality-thresholds.jsonc or code). If you adopt a cited threshold (e.g. 0.88–0.90 for lossy WebP from studies), align the adaptive rule to that and document the source.

---

## SVG and createImageBitmap

- **SVG reference scale:** Rasterization for quality comparison uses 2× width (worker and quality-gate-svg). This is the reference scale for SVG perceptual gate.
- **createImageBitmap:** Worker uses default options (sRGB, document-dependent premultiplyAlpha). No explicit color-space or alpha options unless correctness issues appear.

---

## TinyPNG's Approach

- **Method:** Smart lossy compression via color quantization (combining similar colors, reducing 24-bit to 8-bit where possible).
- **Goal:** "Visually nearly imperceptible" — viewers typically cannot tell compressed from original.
- **Results:** Often 50–80% size reduction with no obvious quality loss; full transparency preserved for PNG.
- **Implication:** We target "visually same as a high-quality original," i.e. at least **JPEG-80–85 equivalent** in perceptual terms.

---

## AVIF & WebP vs JPEG (Industrial Empathy / dssim — still current in 2026)

Source: [AVIF and WebP image quality settings](https://industrialempathy.com/posts/avif-webp-quality-settings/) (Malte Ubl). Quality settings were chosen so AVIF/WebP are **no more different from the source (by dssim) than the corresponding JPEG**. This mapping remains the de facto reference for perceptual parity in 2026.

| JPEG quality | AVIF quality | WebP quality |
|-------------|--------------|--------------|
| 50          | 48           | 55           |
| 60          | 51           | 64           |
| 70          | 56           | 72           |
| **80**      | **64**       | **82**       |

To match **"JPEG 80"** (common high-quality target): use **AVIF 64**, **WebP 82**. For TinyPNG-style "visually same," we use these or slightly higher.

---

## PNG / libimagequant

- **pngquant / libimagequant:** Reduce colors to a palette; `--quality min-max` (0–100) controls acceptability.
- **Common ranges:** 70–80 for web; **72–92** or **75–90** for high fidelity. Our choice: **72–92** (min 72 reduces banding).

---

## Chosen Constants (TinyPNG-Parity)

| Format | Value | Rationale |
|--------|-------|-----------|
| AVIF (raster) | 64 | Match JPEG 80 (Industrial Empathy) |
| AVIF (SVG internal) | 60 | Slightly lower for embedded raster |
| WebP | 82 | Match JPEG 80 |
| JPEG | 84 | Slight margin over 80 |
| PNG quant min/max | 72 / 92 | High fidelity, less banding |
| AVIF tune | ssim | Perceptual tuning |
| AVIF SharpYUV | true | Edge clarity |

**Size-tuned defaults (current worker):** To meet size ≤ baseline × 1.10 (see expected.jsonc and ACCEPTANCE-CRITERIA), the worker uses lower values than the table above: **Photo** — AVIF 55, WebP 72, JPEG 74, PNG quant 58–78 (or 90–98 for small transparent); **Graphic** — AVIF 56 (speed 5), WebP 74, JPEG 76, PNG quant 58–78. CI quality gate (SSIM ≥ 0.98, PSNR ≥ 30 dB) must still pass; these are the active production presets in [optimizer.worker.ts](../src/workers/optimizer.worker.ts).

---

## Content-aware presets (2026)

- **Photo vs graphic:** Two internal presets. **Photo:** AVIF subsample 1 (4:2:0), WebP/JPEG/AVIF quality in Industrial Empathy band, oxipng level 2. **Graphic:** AVIF subsample 3 (4:4:4), slightly higher quality, JPEG chroma 4:4:4 (no subsample), oxipng level 4. See [DESIGN-perfect-optimizer.md](./DESIGN-perfect-optimizer.md).
- **Chroma:** 4:2:0 = photos (smaller, acceptable); 4:4:4 = graphics/text (avoids color fringing). AVIF `subsample` 1 vs 3 in @jsquash; MozJPEG `chroma_subsample` 1 vs 0.
- **Classification heuristic:** Single pass over ImageData: small image (&lt; 10k px) → photo; else unique color count + luminance entropy; if uniqueColors &lt; 2500 and entropy &lt; 6.5 → graphic, else photo. Fallback photo on error. Ref: Stack Overflow “photo vs graphic,” entropy H = -Σ p·log2(p).
- **Why custom (no npm):** As of 2025–2026 there is no widely used, browser/WASM "photo vs graphic" classifier on npm. Squoosh does not classify (user picks codec); TinyPNG's method is proprietary. ML options (e.g. ACACIA, real-vs-synthetic detectors) are Node/Python, large, or not aimed at compression. The heuristic above matches the standard approach (entropy + color count); see e.g. [Stack Overflow: photo or graphic](https://stackoverflow.com/questions/26807303/how-can-i-automatically-determine-whether-an-image-file-depicts-a-photo-or-a-gr). Entropy-only packages (e.g. `image-entropy`) are CLI/Node and not a drop-in for ImageData in a worker.
- **References:** Squoosh #1368 (chroma), openaviffile.com, oxipng levels (2 = fast/good, 4 = better compression).

---

## References (2026-aligned)

- TinyPNG: smart lossy, quantization (official + Stack Overflow / blog posts).
- [Industrial Empathy – AVIF and WebP quality settings](https://industrialempathy.com/posts/avif-webp-quality-settings/) — dssim-based equivalence (reference for 2026).
- pngquant/libimagequant: quality ranges, dithering (72–92 for high fidelity).
- MozJPEG: quality 80–84, trellis, progressive.
- Squoosh/LogRocket: WebP 75–85, AVIF 60–75 ≈ JPEG 80–90.
- 2025–2026: AVIF vs WebP comparisons (SSIM at same size, adaptive delivery); PerCoV2 and perceptual codecs for ultra-low bitrate (out of scope for lossy-optimizer use case).
