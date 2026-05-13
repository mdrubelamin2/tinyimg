# TinyIMG

**Professional, browser-native image optimization. Zero server-side overhead. 100% Privacy.**

TinyIMG is a performance-first engine designed to handle complex vector and raster workloads entirely in the browser using modern WASM codecs and a unique SW-streamed download pipeline.

---

## 🛠 Tech Stack & Strategic Decisions

We chose these libraries to solve specific architectural bottlenecks in high-throughput browser-based image processing.

| Library                | Role              | Strategic Decision                                                                                                                                  |
| :--------------------- | :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React 19 + Vite 8**  | Core Framework    | Using Canary React for stabilized UI patterns; Vite for native WASM and Worker thread orchestration.                                                |
| **@jsquash/\* (WASM)** | Codec Engine      | Production-grade C++ codecs (AVIF, WebP, MozJPEG) and **OxiPNG** for post-processing.                                                               |
| **Libimagequant**      | PNG Quantization  | Expert 8-bit palette reduction with **Floyd-Steinberg dithering**. Turns heavy PNG-24s into light PNG-8s with near-zero visual loss.                |
| **Legend State**       | State Management  | High-performance, fine-grained observables. Keeps the UI 60fps even when thousands of queue updates fire per second.                                |
| **@resvg/resvg-wasm**  | SVG Rasterization | The gold standard for SVG spec compliance. Picked over browser `Canvas` for pixel-perfect, deterministic rendering.                                 |
| **Dexie (IndexedDB)**  | Binary Storage    | Reliable storage for results. Acts as a high-performance fallback when OPFS is unavailable.                                                         |
| **Native File System** | OPFS Engine       | Uses the **Origin Private File System** via a specialized adapter for near-native disk I/O on large assets.                                         |
| **Service Worker**     | Streaming Zip     | Instead of zipping in-memory (which risks OOM), we stream bytes directly to the browser's download manager via a Service Worker fetch interception. |

---

## 🚀 The Journey: From Drop to Download

TinyIMG uses a non-blocking, multi-threaded pipeline to ensure your machine stays responsive under load.

### 1. The Intake (Dropzone)

When you drop an image, we perform local-first validation.

- **Magic Byte Check**: We verify file signatures to ensure corrupt or mislabeled files don't hit the workers.
- **Storage Hand-off**: Originals are persisted to **OPFS (Origin Private File System)** or IndexedDB immediately, preventing "Main Thread Memory Pressure."

### 2. The Queue (State Orchestration)

The image enters the **Legend State** store.

- **Immediate Feedback**: A dedicated `thumbnail.worker` generates a low-res preview instantly.
- **Batched UI Updates**: Results are batched to prevent React from choking on high-frequency worker messages.

### 3. The Worker Pool (Heavy Lifting)

We utilize a **Worker Pool v2** architecture for maximum concurrency.

- **Smart Classification**: On intake, a heuristic engine analyzes color density and luminance entropy to classify images as **Graphic** or **Photo**. This automatically switches encoding presets for optimal quality (e.g., opting for stronger quantization on graphics).
- **Dynamic Threading**: Worker count is automatically tuned based on your CPU core count and current pressure.
- **Transferable Buffers**: Binary data is "transferred" between threads rather than copied, eliminating the CPU cost of data serialization.
- **Adaptive SVG Pipeline**: Complex SVGs are analyzed by a **Unified AST Visitor**. Large vectors are adaptively rasterized into high-DPI AVIF/WebP wrappers to ensure smooth rendering in browsers.

### 4. The Exit (SW Streamed Download)

- **Zero-Memory Zipping**: When you click "Download All," the app sends a manifest to our Service Worker.
- **Streaming Fetch**: The SW intercepts a virtual download URL and "pulls" bytes from IndexedDB as the browser's download stream requests them. This allows zipping 1GB+ batches without using an extra 1GB of RAM.

---

## 🧠 Architecture: Beyond "AI Slop"

TinyIMG is built on **Deterministic Performance Patterns**, not just generic wrappers:

- **Browser Context Isolation**: We use COOP/COEP headers to enable `SharedArrayBuffer`, unlocking advanced threading for codecs.
- **Pixel Guard Protection**: A 256MP guard prevents your browser's GPU from crashing on massive print-res assets.
- **AST-Based SVG Logic**: Our SVG optimization is "SVGOMG-grade," using a single-pass visitor to extract complexity metadata during the optimization pass.
- **Privacy by Design**: No data ever leaves your machine. The "Download" is just a stream from your local storage to your local filesystem.

---

## ⚡ Development

For a deep dive into architecture, state management, and worker orchestration, see the [Detailed Developer Guide](docs/DEVELOPER_GUIDE.md).

### Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5174`.

### Scripts

| Script                 | Description                            |
| :--------------------- | :------------------------------------- |
| `npm run build`        | Production build (`tsc` + Vite).       |
| `npm run test`         | Run unit tests (Vitest).               |
| `npm run test:e2e`     | Run Playwright smoke tests.            |
| `npm run test:quality` | Run raster + SVG quality gates (SSIM). |
| `npm run lint`         | ESLint + Prettier check.               |
| `npm run knip`         | Find unused files/deps.                |

### Creating a Pull Request

1. **Branch**: Create a feature branch from `main`.
2. **Quality**: Ensure `npm run test:full` passes (Unit + E2E + Quality Gates).
3. **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/).
4. **Push**: Open PR against `main`. CI will verify linting, types, and quality gates.

---

**Built for developers who care about the bytes.**
