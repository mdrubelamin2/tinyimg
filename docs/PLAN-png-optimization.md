# PLAN: Industrial-Grade PNG Compression (TinyPNG Style)

Improving PNG compression from lossless-only to high-quality lossy quantization to match and exceed TinyPNG performance.

## The "TinyPNG" Secret Sauce
- **Lossy Pipeline (Default)**: Uses `libimagequant-wasm` (Quantization) -> `OxiPNG`. Quality slider ranges from 1-100%. Even 100% is lossy (highest quality quantization).
- **Lossless Pipeline (Toggle)**: Skips `libimagequant-wasm`, only uses `OxiPNG`. Disables/Hides the quality slider.

## Proposed Changes

### 📦 Dependencies
- [NEW] `libimagequant-wasm`: The industry standard quantization engine.

### 🛠️ UI & Interaction
- **Lossless Toggle**: A new switch in the settings header.
- **Quality Slider**: 
  - Enabled when `Lossless` is OFF.
  - Disabled/Hidden when `Lossless` is ON.
- **Visual Feedback**: Label changes to "Lossless (Optimized)" when toggled.

### 🛠️ Core Worker Refinement

#### [MODIFY] [optimizer.worker.ts](file:///Volumes/Others/projects/tinyimg2/src/workers/optimizer.worker.ts)
- Add `lossless: boolean` to the worker input message.
- If `lossless` is true, skip the `libimagequant` step.
- Merge `libimagequant` logic into the PNG optimization path.

## Verification Plan

### Automated Tests
- Upload a test PNG (96KB) and verify it drops to < 30KB.
- Ensure transparency (alpha channel) is preserved correctly.

### Manual Verification
- Compare visual quality at 80% vs 100%.
- Verify speed/performance impact of the quantization step.

### ⚠️ Licensing Note
`libimagequant` is GPL-3.0/Commercial. For an open-source non-commercial tool, GPL is fine. If the user intends to build a proprietary closed-source product, they may need a commercial license for the engine.
