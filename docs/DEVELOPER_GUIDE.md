# TinyIMG Developer Guide

This guide provides a deep technical dive into the TinyIMG architecture, internal pipelines, and performance strategies.

---

## 🏗 Architecture Overview

TinyIMG is a **main-thread-lite** application. Almost all heavy lifting—decoding, optimizing, encoding, and thumbnailing—happens in background threads (Web Workers). The main thread is reserved for UI rendering and state orchestration.

### Data Flow

1. **Intake**: `registerGlobalFileIntake` (main thread) -> `intake-service` -> `storage`.
2. **State**: `image-store` adds entry to `Legend State`.
3. **Queue**: `worker-coordinator` monitors the queue and dispatches tasks to `WorkerPoolV2`.
4. **Processing**: `optimizer.worker` runs WASM codecs.
5. **Output**: Resulting blobs are saved to `Dexie` or `OPFS`.
6. **Download**: `Service Worker` intercepts request and streams zip.

---

## 🧠 State Management: Legend State

We use **Legend State** instead of Zustand or Redux for its unique "Proxy-based" reactivity.

- **Granular Updates**: When an image's progress updates from `45%` to `46%`, only that specific progress label in the UI re-renders. The rest of the table/list remains untouched.
- **Persistence**: Global settings are synced to `localStorage` via a safe wrapper.
- **In-Flight Tracking**: We track active worker tasks in a dedicated `inFlightTasks$` observable to prevent duplicate processing.

---

## 🧵 Worker Orchestration (Worker Pool v2)

The `WorkerPoolV2` manages a fleet of `optimizer.worker.ts` instances.

- **Concurrency Control**: Defaults to `navigator.hardwareConcurrency - 1`. It monitors "CPU Pressure" (via `scheduler-polyfill` or heuristics) to throttle intake if the system is lagging.
- **Task Prioritization**:
  1. **Thumbnails**: High priority, small payloads.
  2. **Active Queue**: FIFO based on user sorting.
  3. **Metadata Extraction**: Runs on intake.
- **Transferables**: Binary data is passed using `ArrayBuffer` transferables to avoid the O(n) cost of structured cloning.

---

## 🤖 Content Classification Engine

TinyIMG doesn't treat every image the same. Our `classify.ts` engine runs a lightweight analysis before processing:

1. **Color Count**: We use a `Uint8Array` bit vector to count unique RGB colors. If a file has > 256 colors, it's likely a **Photo**.
2. **Luminance Entropy**: We calculate the entropy of the luminance histogram. Low entropy indicates flat colors and sharp edges (typical of **Graphics/Icons**).
3. **Adaptive Presets**:
   - **Graphic**: Optimized for palette consistency and sharp edges.
   - **Photo**: Optimized for gradients and texture retention.

---

## 🖼 PNG Optimization Engine

We use a two-stage pipeline for PNGs that exceeds standard browser `canvas.toBlob` quality:

1. **Quantization (`libimagequant`)**:
   - Converts 24-bit/32-bit images to an optimized 8-bit palette (256 colors).
   - **Floyd-Steinberg Dithering**: Reduces banding artifacts in gradients.
   - **Mild Quantization**: Automatically triggered for photographic content with transparency to balance size and smoothness.
2. **Lossless Post-Pass (`OxiPNG`)**:
   - Compresses the quantized IDAT stream using more aggressive Zlib/Deflate strategies without touching pixels.

---

## 🎨 SVG Optimization Pipeline

TinyIMG treats SVGs as code, not just images.

1. **Analysis Pass**: `SVGO` walks the AST. We use a custom visitor to count nodes and path segments.
2. **Heuristic Check**:
   - If complexity > **1,500 nodes**, the file is marked for **Adaptive Rasterization**.
   - Complexity is high if it includes massive embedded rasters or deep filter chains.
3. **Adaptive Output**:
   - **Vector Path**: Cleaned XML via `svgo`.
   - **Raster Path**: `resvg` renders the SVG to a bitmap, which is then encoded as a high-DPI AVIF/WebP. This bitmap is wrapped in an SVG `<image>` tag to maintain responsive `viewBox` behavior.

---

## 💾 Storage & Persistence

We use a hybrid storage strategy to bypass browser memory limits and handle high-throughput binary I/O:

- **Native File System Adapter (OPFS)**: In supported browsers (Chromium), we use the **Origin Private File System**. This provides a dedicated, high-performance sandbox that bypasses the slower IndexedDB layer for original assets and large binary payloads.
- **Dexie (IndexedDB)**: Reliable, transactional storage used for metadata, session state, and as a **robust binary fallback** when OPFS is unavailable (e.g., Firefox, Safari, or non-secure contexts).
- **Memory Guard**: Large blobs are never kept in JS variables. They are moved to storage immediately, and we only pass around `payloadKey` (UUIDs).

---

## 📥 The Download Stream (Service Worker)

To zip 100+ images without crashing the tab:

1. Main thread sends a `MANIFEST_READY` message to the Service Worker.
2. We create a hidden `iframe` pointing to `/_/download-zip/[batchId]`.
3. The SW intercepts this request and generates a `ReadableStream`.
4. As the browser's download manager pulls data, the SW reads blobs from `IndexedDB` and wraps them in ZIP headers on-the-fly.
5. Result: **Zero-memory footprint zipping.**

---

## 🧪 Quality Assurance

### SSIM Quality Gate

We don't just check file size. Our `scripts/quality-gate.mjs` uses **Structural Similarity Index (SSIM)** to compare the original vs. optimized image.

- **Pass**: SSIM > 0.98.
- **Warn**: SSIM < 0.95 (potential visual artifacts).

### E2E Benchmarking

Playwright runs automated benchmarks in `src/tests/e2e/benchmarking.spec.ts`, measuring:

- Time to first thumbnail.
- Worker throughput (images/sec).
- Memory peak during zip generation.

---

## 🛠 Adding a New Codec

1. Add the WASM package to `package.json`.
2. Register the codec in `src/lib/codecs/`.
3. Update `src/workers/optimizer-wasm.ts` to include the new encoder/decoder.
4. Add the output format to `src/constants/formats.ts`.
5. Run `npm run test:quality` to verify the new codec's fidelity.
