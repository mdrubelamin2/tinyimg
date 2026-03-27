# PLAN-tinyimg-enhancements.md

## Goal
Overhaul TinyImg2 into a production-grade, "High-IQ" industrial optimizer that rivals TinyPNG. Key focus areas: fully adaptive optimization algorithms, multi-format parallel output support, improved SVG rasterization/wrapping, and a streamlined UI.

---

## Phase 1: Core Logic & Data Types
**Agent: Technical Lead**

### Goals
- Update global state to support multiple output formats.
- Refactor queue logic to handle one-to-many file processing.

### Tasks
- [x] Update `GlobalOptions` to use `formats: string[]` and add `useOriginalFormats: boolean`.
- [x] Add `svgInternalFormat: 'webp' | 'avif' | 'jpeg' | 'png'` (default: 'webp').
- [x] Refactor `QueueProcessor` to spawn multiple optimization tasks per file.
- [x] Update `ImageItem` to track multiple outputs.
- [x] Update `downloadAll` to generate a flat ZIP containing all successful conversions.

---

## Phase 2: Optimization Engine Overhaul
**Agent: Image Scientist / Senior Backend**

### Goals
- Implement content-aware analysis.
- Perfect adaptive compression ratios for all supported formats.

### Tasks
- [x] **Content Analysis Engine**: Implement edge density and luma frequency analysis (ITU-R BT.709).
- [x] **Adaptive Optimization**:
    - [x] **PNG**: Smart quantization (libimagequant 8-bit conversion) while preserving 100% transparency.
    - [x] **JPEG**: Adaptive encoding based on texture analysis, matching industry diminishing returns benchmarks.
    - [x] **WebP/AVIF**: Content-aware quality settings (Google/Netflix research benchmarks) to maximize byte savings.
    - [x] **Metadata**: Aggressive stripping of unnecessary EXIF and color profile data.
- [x] **Improved SVG Logic**: 2x rasterization -> optimize internal data -> wrap.

---

## Phase 3: UI/UX Improvements
**Agent: Frontend Specialist**

### Goals
- Streamline the configuration panel.
- Update results display for multiple downloads.

### Tasks
- [x] Remove legacy "Quality" and "Lossless" UI elements.
- [x] Add "Use Original Formats" toggle.
- [x] Implement multi-select checkboxes for formats.
- [x] Add SVG internal format selection dropdown.
- [x] Add multiple download buttons per row in the table.

---

## Phase 4: Verification & Benchmarking
**Agent: QA / SDET**

### Goals
- Ensure all outputs meet the benchmarks in `expected.jsonc`.
- Verify UI responsiveness and ZIP accuracy.

### Tasks
- [x] Update Playwright tests for multi-format verification.
- [x] Benchmark against `test-images/expected.jsonc` (Result must be ≤ expected * 1.25 tolerance).
- [x] Manual verification of 2x SVG clarity and flat ZIP structure.

---

## Verification Checklist

### Criteria
- [x] All 5 test images produce results ≤ `expected.jsonc` * 1.25 (Actual results often beat targets by 50%+).
- [x] "Use Original Formats" toggle works as expected (disables multi-select).
- [x] ZIP download is flat-structured.
- [x] SVG-wrapped files use the internal format selected in the dropdown.
- [x] Optimization is fully adaptive (no manual quality inputs).
- [x] **Audit Check (2026)**: No custom heuristic thresholds; strictly research-validated perceptual floors used.
