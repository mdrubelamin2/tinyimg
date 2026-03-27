# TinyIMG Revamp: The Definitive Image Optimization Tool

## Deep Research Report — March 2026

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [The Competitive Landscape](#2-the-competitive-landscape)
3. [Codec-by-Codec Deep Dive](#3-codec-by-codec-deep-dive)
4. [SVG Optimization Landscape](#4-svg-optimization-landscape)
5. [WASM Infrastructure Libraries](#5-wasm-infrastructure-libraries)
6. [Architecture Best Practices](#6-architecture-best-practices)
7. [Strategic Revamp Recommendation](#7-strategic-revamp-recommendation)

---

## 1. Current State Assessment

### What TinyIMG Does Today

| Capability | Implementation |
|---|---|
| **Input formats** | PNG, JPEG, WebP, AVIF, SVG |
| **Output formats** | WebP, AVIF, JPEG, PNG, SVG (optimized/wrapped) |
| **JPEG encoder** | MozJPEG via `@jsquash/jpeg` |
| **WebP encoder** | libwebp via `@jsquash/webp` |
| **AVIF encoder** | libavif via `@jsquash/avif` |
| **PNG pipeline** | libimagequant (lossy quant) → OxiPNG (lossless recompress) via `@jsquash/oxipng` |
| **SVG optimizer** | SVGO v4 (multipass) |
| **SVG rasterizer** | Dual-path: browser (`createImageBitmap`) or resvg-wasm |
| **Downscaler** | pica (Lanczos3 + unsharp) |
| **Content classifier** | Custom photo-vs-graphic heuristic (color count + entropy) |
| **Architecture** | Web Worker pool (2-6 workers), React 19 UI, Vite 8, TailwindCSS 4 |
| **Privacy** | 100% client-side, zero server uploads |

### Existing Strengths

- **Privacy-first**: All processing on-device — a genuine competitive edge over TinyPNG, Kraken.io, ShortPixel
- **Smart SVG pipeline**: Dual rasterizer with DPR-aware display-density mode is rare
- **Content-aware presets**: Photo vs graphic classification tunes encoder params per image
- **Lossless-vs-lossy safeguard**: Automatically picks whichever is smaller within a ratio
- **Clean architecture**: Constants file, no magic values, thin coordinator pattern, queue modules

### Existing Weaknesses

- **No JPEG XL support** — the format is coming back to Chromium (Jan 2026 behind flag) and Firefox
- **MozJPEG only** — Jpegli (Google, 2024) compresses 35% better at same perceived quality
- **No resize/crop** — every competitor offers this; missing a core user need
- **Single SVG optimizer** — SVGO is 50-100x slower than Rust alternatives (svgtidy, svgo-rs)
- **No quality slider** — users can't tune compression; everything is preset-locked
- **No image preview/comparison** — Squoosh's killer feature; users can't see quality tradeoffs
- **No metadata stripping controls** — no EXIF/ICC profile handling UI
- **No GIF/TIFF/BMP/HEIC input** — limits "final stop" positioning
- **~500KB+ WASM bundle** — no lazy loading or streaming instantiation of codecs

---

## 2. The Competitive Landscape

### Tier 1: Direct Competitors (Browser-Based Optimizers)

| Tool | Strengths | Weaknesses |
|---|---|---|
| **[Squoosh](https://squoosh.app)** (Google) | Gold-standard WASM codecs, real-time before/after preview, granular slider control, JPEG XL support, open source | **Single image only**, no batch, CLI abandoned (2023), no folder/ZIP intake |
| **[TinyPNG](https://tinypng.com)** | Simple UX, excellent lossy PNG (pngquant), WebP/AVIF support, WordPress plugin, trusted brand | **Server-side** (privacy risk), 5MB free limit, 100 images/month cap, no SVG, no quality control |
| **[Zipic](https://zipic.app)** | Client-side WASM, batch processing, modern UI | Smaller format support, less mature codecs |
| **[TinyImage.online](https://tinyimage.online)** | Client-side, privacy-focused | Limited codec options |
| **[Optimizilla](https://imagecompressor.com)** | Batch (up to 20), individual quality sliders, side-by-side preview | **Server-side**, JPEG/PNG/GIF only, no modern formats |

### Tier 2: Server-Side / API Services

| Tool | Strengths | Weaknesses |
|---|---|---|
| **[Kraken.io](https://kraken.io)** | API + web UI, lossy/lossless, WebP, CDN integration | Paid after free tier, server-side |
| **[ShortPixel](https://shortpixel.com)** | Lossy/glossy/lossless, WebP/AVIF, WordPress plugin, auto-optimize | Paid, server-side |
| **[Cloudinary](https://cloudinary.com)** | Full image CDN, auto-format, auto-quality, f_auto, q_auto | Expensive at scale, overkill for one-off |
| **[imgix](https://imgix.com)** | Real-time URL-based transforms, CDN delivery | Expensive, server-dependent |

### Tier 3: Desktop / CLI Tools

| Tool | Strengths | Weaknesses |
|---|---|---|
| **[ImageOptim](https://imageoptim.com)** (Mac) | Lossless, strips metadata, MozJPEG/pngquant/Zopfli under hood | Mac-only desktop, no modern format output |
| **[Caesium](https://saerasoft.com/caesium)** | Cross-platform, 90% compression, batch, open source | No AVIF/WebP output, no browser version |
| **[sharp CLI](https://sharp.pixelplumbing.com)** | Fastest Node.js (libvips), resize/convert, 4-5x faster than imagemin | Not browser-based, no UI |

### Key Takeaway

> **No single tool combines**: client-side privacy + batch processing + all modern formats (including JXL) + quality previews + SVG optimization + resize/crop + zero cost. That is the gap TinyIMG should fill.

---

## 3. Codec-by-Codec Deep Dive

### 3.1 JPEG Encoders

| Encoder | Quality-per-byte | Speed | WASM Available? | Notes |
|---|---|---|---|---|
| **Jpegli** (Google, 2024) | ⭐⭐⭐⭐⭐ | Comparable to MozJPEG | ✅ (part of libjxl) | 35% smaller than MozJPEG at same SSIM. Adaptive quantization from JXL. 10+ bit internal. **The new king.** |
| **MozJPEG** (Mozilla) | ⭐⭐⭐⭐ | 4-7x slower than libjpeg-turbo | ✅ (`@jsquash/jpeg`) | Trellis quant + jpgcrush. 5-8% better than libjpeg-turbo. Still excellent. |
| **libjpeg-turbo** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ Fastest | ✅ | Speed king. Decode-only recommendation from Google for Jpegli outputs. |

> [!IMPORTANT]
> **Recommendation**: Replace MozJPEG with **Jpegli** as the primary JPEG encoder. Jpegli is API/ABI-compatible with MozJPEG and libjpeg-turbo, so the switch is relatively seamless. A WASM build exists within the libjxl project. Keep MozJPEG as fallback for edge cases.

### 3.2 WebP Encoders

| Encoder | Notes |
|---|---|
| **libwebp** (Google) | The only WebP encoder. `@jsquash/webp` wraps it well. `use_sharp_yuv` is critical for chroma fidelity. Current implementation is already optimal with `method: 4-6`, `exact: 1`. |

> [!NOTE]
> WebP is a mature, stable codec. The current `@jsquash/webp` integration is solid. No changes needed here — just tune presets.

### 3.3 AVIF Encoders

| Encoder | Quality | Speed | WASM Notes |
|---|---|---|---|
| **aomenc** (libaom) | ⭐⭐⭐⭐ | Moderate | Best in single-threaded WASM (faster + smaller than rav1e in WASM) |
| **SVT-AV1** (Intel/Netflix) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ Fastest | Excellent quality-to-speed ratio, but requires threading for full power |
| **rav1e** (Rust) | ⭐⭐⭐⭐ | Slower | Memory-safe, but produces larger files in WASM single-thread context |

> [!IMPORTANT]
> **Recommendation**: Stick with **aomenc via `@jsquash/avif`** (which uses libavif → libaom). It's the best encoder for single-threaded WASM. Monitor SVT-AV1 WASM support as WASM threads become standard. Current tuning params (SSIM tune, sharpYUV, chromaDeltaQ) are already excellent.

### 3.4 PNG Pipeline

| Tool | Type | Notes |
|---|---|---|
| **pngquant / libimagequant** | Lossy (palette reduction) | Best-in-class lossy PNG. 60-80% reduction. **Already used.** |
| **OxiPNG** | Lossless (deflate recompression) | Rust, multithreaded, SIMD. Successor to OptiPNG. 15-40% lossless. **Already used.** |
| **ECT** (Efficient Compression Tool) | Lossless (Zopfli-level) | Can squeeze ~2-5% more than OxiPNG alone. oxipng + ECT is "surprisingly good." No WASM build currently. |

> [!NOTE]
> The current PNG pipeline (libimagequant → OxiPNG) is already **best-in-class**. The only improvement would be adding ECT on top, but its WASM availability is limited.

### 3.5 JPEG XL (JXL) — The Prodigal Format

| Aspect | Status (March 2026) |
|---|---|
| **Chrome/Chromium** | Re-added Jan 2026 behind `#enable-jxl-image-format` flag. Using new Rust decoder (jxl-rs) for security. |
| **Safari** | Full support since Safari 17 (Sep 2023) |
| **Firefox** | "In process of landing" as of Jan 2026 |
| **Key advantages** | Lossless JPEG recompression (~20% smaller), progressive decode, HDR support, superior to AVIF at low bitrates |
| **WASM codecs** | `@jsquash/jxl` (libjxl), `jxl.js` (Squoosh-derived), `jxl-wasm` (Node.js) |

> [!CAUTION]
> **Recommendation**: Add JXL as an **experimental output format** now. By the time TinyIMG launches, native browser support will likely be default-on. JXL's killer feature is **lossless JPEG recompression** — it can shrink existing JPEGs ~20% without any quality loss, which no other format can do. This is a massive differentiator.

---

## 4. SVG Optimization Landscape

### SVG Optimizers Compared

| Tool | Language | Speed vs SVGO | Quality | WASM? | Maturity |
|---|---|---|---|---|---|
| **SVGO v4** | JavaScript | Baseline (1x) | ⭐⭐⭐⭐ Excellent plugin ecosystem | N/A (JS) | ⭐⭐⭐⭐⭐ Industry standard |
| **svgtidy** | Rust | **50-100x faster** | ⭐⭐⭐⭐ | ✅ WASM build | Newer, actively developed |
| **svgo-rs** | Rust | ~10-30x faster | ⭐⭐⭐⭐ (SVGO-compatible plugins) | ✅ (NAPI-RS + WASM) | Active development |
| **oxvg** | Rust | "Multiple times faster" | ⭐⭐⭐⭐ | ✅ WASM build | Active development |
| **svgcleaner** | Rust | ~very fast (~1ms/icon) | ⭐⭐⭐ (lossless focus) | Uncertain | Maintenance mode |

### SVG Rasterizers Compared

| Tool | Language | Notes |
|---|---|---|
| **resvg** (current) | Rust/WASM | Deterministic, high quality, supports most SVG features. **Already used.** |
| **Browser engine** (current) | N/A | Uses `createImageBitmap` + `OffscreenCanvas`. Chromium-quality output. **Already used.** |
| **canvg** | JS | Listed as dependency but appears unused in the pipeline. Could remove. |

> [!TIP]
> **Recommendation**: Evaluate **svgtidy WASM** as a replacement or complement to SVGO. 50-100x speed improvement for SVG optimization is significant for batch processing. Keep SVGO as fallback since svgtidy's plugin coverage may not match SVGO v4's extensive plugin ecosystem yet. The dual rasterizer (browser + resvg) approach is already best-in-class — keep it.

---

## 5. WASM Infrastructure Libraries

### Comprehensive Comparison

| Library | Foundation | Bundle Size | Browser Support | Key Strength | Key Weakness |
|---|---|---|---|---|---|
| **jSquash (@jsquash/*)** | Squoosh codecs | ~500KB+ (all codecs) | ✅ Full | Easy integration, battle-tested encoders | Missing JXL stable, no resize |
| **wasm-vips** | libvips | ~4.6MB | ✅ (needs SharedArrayBuffer) | Full pipeline (resize, convert, chain ops), low memory | Large bundle, 2-8x slower than native sharp, early docs |
| **Photon** | Rust custom | ~200KB | ✅ Full | Tiny bundle, 90+ functions, 4-10x faster than JS | No advanced codec control (quality params) |
| **FFmpeg.wasm** | FFmpeg | ~25MB+ | ✅ Full | Everything multimedia | Massive bundle, overkill for images |
| **OpenCV.js** | OpenCV | ~8MB | ✅ Full | Computer vision, analysis | Way too large for image optimization |
| **sharp (native)** | libvips | N/A | ❌ Node only | Fastest server-side, 4-5x faster than imagemin | Not browser-compatible |

> [!IMPORTANT]
> **Recommendation**: Continue with **jSquash as the primary codec layer**. It's the best balance of quality, bundle size, and browser compatibility. Use **wasm-vips** only if resize/crop is needed and jSquash can't handle it — but consider using **pica** (already in the project) or the **Canvas API** for resize instead, since wasm-vips adds 4.6MB to the bundle. For the resize feature, pica or a purpose-built WASM resize module is more appropriate.

---

## 6. Architecture Best Practices (2026)

### What the Best Client-Side Optimizers Do

1. **Transferable Objects**: Use `ArrayBuffer` transfer (not copy) between main thread and workers via `postMessage({ ... }, [buffer])`. TinyIMG already does this implicitly via Blob transfer.

2. **Streaming WASM Instantiation**: Use `WebAssembly.compileStreaming()` to compile WASM modules as they download, cutting cold-start time. Currently each codec loads on first use — good, but could benefit from preloading codecs likely to be used.

3. **Lazy Codec Loading**: Only load the WASM modules for formats actually requested. Don't load AVIF codec if user only wants WebP. TinyIMG already does this via dynamic `import()`.

4. **Worker Pool with Task Stealing**: Fixed-size pool (2-6 workers) with task queue. TinyIMG has this. Could enhance with priority queuing (smaller files first for perceived speed).

5. **Memory Reuse**: For batch processing, reuse allocated WASM memory across images instead of allocating fresh buffers per image. This reduces GC pressure.

6. **Progress Reporting**: Stream per-stage timing back to UI (decode → classify → encode). TinyIMG already does this with performance marks.

7. **Cancellation Support**: Allow users to cancel in-flight operations. Currently missing — a significant UX gap for large batches.

8. **Resize Before Encode**: For photos from cameras (4000×3000+), resize to target dimensions *before* encoding to dramatically reduce encode time and output size. This is a major missing feature.

---

## 7. Strategic Revamp Recommendation

### Vision

> **TinyIMG becomes the definitive, zero-cost, privacy-first image optimization and conversion tool** — the place where "I need to optimize/convert an image" starts and ends. It should make TinyPNG feel like a toy and Squoosh like a prototype.

### Priority 1: Format Supremacy (Differentiation)

| Change | Impact | Effort |
|---|---|---|
| Add **JPEG XL** output (via `@jsquash/jxl`) | 🔴 HIGH — unique lossless JPEG recompression | Medium |
| Add **Jpegli** as JPEG encoder (replace MozJPEG) | 🔴 HIGH — 35% smaller JPEGs | Medium (needs WASM build from libjxl) |
| Add **GIF input** (decode to frames → optimize) | 🟡 MEDIUM — fills gap | Low |
| Add **BMP/TIFF/HEIC input** (decode-only) | 🟡 MEDIUM — "accept everything" positioning | Low-Medium |

### Priority 2: User Power Features (Parity + Exceed)

| Change | Impact | Effort |
|---|---|---|
| **Quality slider** (per-format, global or per-image) | 🔴 HIGH — Squoosh's defining feature | Medium |
| **Before/after preview** (split-view or toggle) | 🔴 HIGH — lets users see tradeoffs | Medium-High |
| **Resize/crop** (dimensions, percentage, or fit-to-max) | 🔴 HIGH — every competitor has this | Medium |
| **Metadata control** (strip EXIF/ICC, keep/remove) | 🟡 MEDIUM — privacy and size win | Low |
| **Cancellation** for in-flight images | 🟡 MEDIUM — UX for large batches | Low-Medium |

### Priority 3: Performance Dominance (Speed)

| Change | Impact | Effort |
|---|---|---|
| Evaluate **svgtidy WASM** to replace/complement SVGO | 🔴 HIGH — 50-100x SVG optimization speed | Medium |
| **Streaming WASM instantiation** (`compileStreaming`) | 🟡 MEDIUM — faster cold start | Low |
| **Priority queue** (small files first) | 🟡 MEDIUM — perceived performance | Low |
| **Codec preloading** for likely formats | 🟢 LOW — marginal improvement | Low |

### Priority 4: UX Excellence (The "Wow" Factor)

| Change | Impact | Effort |
|---|---|---|
| **Side-by-side comparison** (like Squoosh's slider) | 🔴 HIGH — the feature that makes people stay | High |
| **Per-image format selection** (not just global) | 🟡 MEDIUM — power users need this | Medium |
| **Dark mode** | 🟡 MEDIUM — expected in 2026 | Low |
| **Drag-to-reorder** in queue | 🟢 LOW — nice-to-have | Low |
| **Keyboard shortcuts** (space to preview, delete to remove) | 🟢 LOW — power user delight | Low |

### Priority 5: Architecture Improvements

| Change | Impact | Effort |
|---|---|---|
| Remove **canvg** dependency (appears unused) | 🟢 Bundle size win | Trivial |
| Extract **encoder presets to a config file** (not hardcoded) | 🟡 Maintainability | Low |
| Add **worker cancellation** via `AbortController` pattern | 🟡 MEDIUM — UX for large batches | Medium |
| **WASM SIMD** enforcement for supported codecs | 🟡 Performance win on modern browsers | Low |
| Investigate **SharedArrayBuffer** for zero-copy worker data | 🟡 Performance win | Medium |

### What NOT to Do

> [!WARNING]
> - ❌ **Don't use wasm-vips** as main engine — 4.6MB bundle kills load time; jSquash codecs are better tuned for individual formats
> - ❌ **Don't build a server-side component** — the zero-server privacy story is the #1 differentiator
> - ❌ **Don't add FFmpeg.wasm** — 25MB+ for video features nobody asked for
> - ❌ **Don't support animated WebP/AVIF** initially — complexity explosion for niche use case
> - ❌ **Don't chase "AI-powered" compression** — marketing gimmick with no proven browser-WASM advantage over traditional codecs

---

## Appendix A: Every Tool Researched

### Browser-Based Optimizers
- Squoosh (Google), TinyPNG, Optimizilla, Zipic, TinyImage.online, Compressor.io

### Server-Side Services
- Kraken.io, ShortPixel, Cloudinary, imgix, ImageKit, Uploadcare

### Desktop/CLI Tools
- ImageOptim, Caesium, PngGauntlet, RIOT, sharp CLI, imagemin

### WASM Codec Libraries
- jSquash (@jsquash/*), Photon, wasm-vips, FFmpeg.wasm, OpenCV.js, sharp-wasm32

### JPEG Encoders
- MozJPEG, libjpeg-turbo, Jpegli (Google 2024)

### WebP Encoders
- libwebp (Google) — the only one

### AVIF Encoders
- aomenc (libaom), SVT-AV1 (Intel/Netflix), rav1e (Rust), cavif

### JPEG XL Codecs
- libjxl (reference), jxl-rs (Rust decoder for Chromium), @jsquash/jxl, jxl.js, jxl-wasm

### PNG Tools
- OxiPNG, OptiPNG, pngquant/libimagequant, ECT, Zopfli, advpng

### SVG Optimizers
- SVGO v4, svgtidy (Rust), svgo-rs (Rust), oxvg (Rust), svgcleaner (Rust)

### SVG Rasterizers
- resvg (Rust/WASM), browser engine (createImageBitmap), canvg (JS), librsvg

### Resize/Downscale Libraries
- pica (JS, Lanczos), sharp (libvips, Node), wasm-vips, Photon, browser Canvas API

---

## Appendix B: Format Support Matrix (March 2026)

| Format | Chrome/Edge | Firefox | Safari | Best Encoder | Our Status |
|---|---|---|---|---|---|
| **JPEG** | ✅ | ✅ | ✅ | Jpegli | ⚠️ Using MozJPEG |
| **PNG** | ✅ | ✅ | ✅ | pngquant + OxiPNG | ✅ Best-in-class |
| **WebP** | ✅ | ✅ | ✅ | libwebp | ✅ Solid |
| **AVIF** | ✅ | ✅ | ✅ (16.4+) | aomenc / SVT-AV1 | ✅ Good |
| **JPEG XL** | 🔶 Flag-only | 🔶 Landing | ✅ | libjxl / Jpegli | ❌ Missing |
| **SVG** | ✅ | ✅ | ✅ | SVGO / svgtidy | ✅ Good (slow) |
| **GIF** | ✅ | ✅ | ✅ | — (decode only) | ❌ Missing |
| **HEIC** | ❌ | ❌ | ✅ | — (decode only) | ❌ Missing |
| **TIFF** | ❌ | ❌ | ❌ | — (decode only) | ❌ Missing |
| **BMP** | ✅ | ✅ | ✅ | — (decode only) | ❌ Missing |

---

## Appendix C: Competitor Feature Matrix

| Feature | TinyIMG | Squoosh | TinyPNG | Optimizilla | Kraken.io |
|---|---|---|---|---|---|
| Client-side (privacy) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Batch processing | ✅ | ❌ | ✅ (20) | ✅ (20) | ✅ |
| AVIF output | ✅ | ✅ | ✅ | ❌ | ❌ |
| WebP output | ✅ | ✅ | ✅ | ❌ | ✅ |
| JXL output | ❌ | ✅ | ❌ | ❌ | ❌ |
| SVG optimization | ✅ | ❌ | ❌ | ❌ | ❌ |
| Quality slider | ❌ | ✅ | ❌ | ✅ | ✅ |
| Before/after preview | ❌ | ✅ | ❌ | ✅ | ❌ |
| Resize/crop | ❌ | ✅ | ❌ | ❌ | ✅ |
| ZIP upload | ✅ | ❌ | ❌ | ❌ | ✅ |
| Folder upload | ✅ | ❌ | ❌ | ❌ | ❌ |
| No file size limit | ✅ (25MB) | ✅ | ❌ (5MB) | ❌ | ❌ |
| Free / unlimited | ✅ | ✅ | ❌ | ✅ | ❌ |
| Content-aware presets | ✅ | ❌ | ✅ | ❌ | ❌ |
| DPR-aware SVG raster | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Summary: The Path to Being the Final Stop

tinyimg2 already has a **solid foundation** — privacy-first WASM processing, content-aware presets, and a smart SVG pipeline that competitors lack. The revamp should focus on:

1. **Format completeness**: Add JXL output (killer lossless JPEG recompression) + Jpegli encoder + GIF/BMP/HEIC input
2. **User control**: Quality sliders + before/after preview (these are the features that make Squoosh special)
3. **Performance**: svgtidy WASM for 50-100x faster SVG + streaming WASM instantiation
4. **Missing basics**: Resize/crop, metadata controls, dark mode
5. **Architecture polish**: Worker cancellation, priority queue, remove dead dependencies

The result should be a tool where you can say: *"Drop any image, get the smallest file with the best quality, in any format, in seconds, and it never leaves your browser."*
