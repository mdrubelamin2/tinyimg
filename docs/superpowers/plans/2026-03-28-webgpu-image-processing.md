# WebGPU Image Processing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement GPU-accelerated image resizing using WebGPU compute shaders with seamless CPU fallback.

**Architecture:** Create a `src/lib/gpu/` module with WGSL shaders for bilinear resize, managed by a dedicated GPU worker that handles texture upload, compute dispatch, and readback.

**Tech Stack:** TypeScript, WebGPU API, WGSL (WebGPU Shading Language), Transferable ImageBitmap.

---

### Task 1: WebGPU Device Initialization & Capability Probe

**Files:**
- Create: `src/lib/gpu/gpu-device.ts`
- Test: `src/tests/unit/gpu-device.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/tests/unit/gpu-device.test.ts
import { describe, it, expect, vi } from 'vitest';
import { initGpuDevice, isGpuAvailable } from '../../lib/gpu/gpu-device';

describe('GPU Device', () => {
  it('returns false when navigator.gpu is undefined', async () => {
    vi.stubGlobal('navigator', { gpu: undefined });
    const available = await isGpuAvailable();
    expect(available).toBe(false);
  });

  it('returns device when GPU is available', async () => {
    const mockAdapter = {
      requestDevice: vi.fn().mockResolvedValue({
        limits: {
          maxTextureDimension2D: 16384,
          maxComputeWorkgroupStorageSize: 32768,
        },
      }),
    };
    vi.stubGlobal('navigator', { gpu: { requestAdapter: vi.fn().mockResolvedValue(mockAdapter) } });
    
    const device = await initGpuDevice();
    expect(device).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/tests/unit/gpu-device.test.ts`
Expected: FAIL due to missing file.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/gpu/gpu-device.ts
let cachedDevice: GPUDevice | null = null;

export async function isGpuAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

export async function initGpuDevice(): Promise<GPUDevice | null> {
  if (cachedDevice) {
    return cachedDevice;
  }
  
  if (!('gpu' in navigator)) {
    return null;
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return null;
    }
    
    cachedDevice = await adapter.requestDevice({
      requiredLimits: {
        maxTextureDimension2D: 16384,
        maxComputeWorkgroupStorageSize: 32768,
      },
    });
    
    return cachedDevice;
  } catch {
    return null;
  }
}

export function getGpuLimits() {
  return cachedDevice?.limits ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/tests/unit/gpu-device.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/gpu/gpu-device.ts src/tests/unit/gpu-device.test.ts
git commit -m "feat: add WebGPU device initialization and capability probe"
```

---

### Task 2: WGSL Bilinear Resize Compute Shader

**Files:**
- Create: `src/lib/gpu/shaders/resize.wgsl`
- Create: `src/lib/gpu/resize-pipeline.ts`
- Test: `src/tests/unit/resize-pipeline.test.ts`

- [ ] **Step 1: Write the WGSL shader**

```wgsl
// src/lib/gpu/shaders/resize.wgsl
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;

struct ResizeParams {
  scaleX: f32,
  scaleY: f32,
  inputWidth: u32,
  inputHeight: u32,
}

@group(0) @binding(2) var<uniform> params: ResizeParams;

@compute @workgroup_size(8, 8)
fn resizeMain(@builtin(global_invocation_id) id: vec3<u32>) {
  let outX = id.x;
  let outY = id.y;
  
  if (outX >= textureDimensions(outputTex).x || outY >= textureDimensions(outputTex).y) {
    return;
  }
  
  // Calculate source position
  let srcX = f32(outX) * params.scaleX;
  let srcY = f32(outY) * params.scaleY;
  
  // Bilinear interpolation: sample 4 neighboring texels
  let x0 = u32(floor(srcX));
  let y0 = u32(floor(srcY));
  let x1 = min(x0 + 1u, params.inputWidth - 1u);
  let y1 = min(y0 + 1u, params.inputHeight - 1u);
  
  let fx = fract(srcX);
  let fy = fract(srcY);
  
  let p00 = textureLoad(inputTex, vec2<i32>(x0, y0), 0);
  let p01 = textureLoad(inputTex, vec2<i32>(x0, y1), 0);
  let p10 = textureLoad(inputTex, vec2<i32>(x1, y0), 0);
  let p11 = textureLoad(inputTex, vec2<i32>(x1, y1), 0);
  
  // Interpolate
  let result = mix(
    mix(p00, p10, fx),
    mix(p01, p11, fx),
    fy
  );
  
  textureStore(outputTex, vec2<i32>(outX, outY), result);
}
```

- [ ] **Step 2: Write the pipeline wrapper**

```typescript
// src/lib/gpu/resize-pipeline.ts
import { initGpuDevice } from './gpu-device';
import resizeShader from './shaders/resize.wgsl?raw';

interface ResizePipeline {
  bindGroup: GPUBindGroup;
  pipeline: GPUComputePipeline;
}

export async function createResizePipeline(
  inputWidth: number,
  inputHeight: number,
  outputWidth: number,
  outputHeight: number
): Promise<ResizePipeline | null> {
  const device = await initGpuDevice();
  if (!device) return null;

  const inputTex = device.createTexture({
    size: [inputWidth, inputHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  const outputTex = device.createTexture({
    size: [outputWidth, outputHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });

  const paramsBuffer = device.createBuffer({
    size: 16, // 4 floats * 4 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const paramsData = new Float32Array([
    inputWidth / outputWidth,
    inputHeight / outputHeight,
    inputWidth,
    inputHeight,
  ]);
  device.queue.writeBuffer(paramsBuffer, 0, paramsData);

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba8unorm' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: inputTex.createView() },
      { binding: 1, resource: outputTex.createView() },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });

  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: {
      module: device.createShaderModule({ code: resizeShader }),
      entryPoint: 'resizeMain',
    },
  });

  return { bindGroup, pipeline };
}
```

- [ ] **Step 3: Write the test**

```typescript
// src/tests/unit/resize-pipeline.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createResizePipeline } from '../../lib/gpu/resize-pipeline';

describe('Resize Pipeline', () => {
  it('returns null when GPU is unavailable', async () => {
    vi.stubGlobal('navigator', { gpu: undefined });
    const pipeline = await createResizePipeline(1920, 1080, 800, 600);
    expect(pipeline).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/tests/unit/resize-pipeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/gpu/shaders/resize.wgsl src/lib/gpu/resize-pipeline.ts src/tests/unit/resize-pipeline.test.ts
git commit -m "feat: add WGSL bilinear resize compute shader and pipeline"
```

---

### Task 3: GPU Worker Integration

**Files:**
- Create: `src/workers/gpu.worker.ts`
- Create: `src/lib/gpu/gpu-worker-client.ts`
- Test: `src/tests/unit/gpu-worker-client.test.ts`

- [ ] **Step 1: Write the worker**

```typescript
// src/workers/gpu.worker.ts
import { initGpuDevice } from '../lib/gpu/gpu-device';
import { createResizePipeline } from '../lib/gpu/resize-pipeline';

self.onmessage = async (e: MessageEvent<{ type: string; payload: any }>) => {
  const { type, payload } = e.data;

  if (type === 'resize') {
    const { bitmap, width, height } = payload;
    
    const device = await initGpuDevice();
    if (!device) {
      self.postMessage({ type: 'error', error: 'GPU unavailable' });
      return;
    }

    // Upload bitmap to GPU texture
    const inputTex = device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: inputTex },
      [bitmap.width, bitmap.height]
    );

    // Create pipeline and dispatch
    const pipeline = await createResizePipeline(bitmap.width, bitmap.height, width, height);
    if (!pipeline) {
      self.postMessage({ type: 'error', error: 'Pipeline creation failed' });
      return;
    }

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, pipeline.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();

    // Readback
    const outputTex = device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
    });

    const readBuffer = device.createBuffer({
      size: width * height * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    commandEncoder.copyTextureToBuffer(
      { texture: outputTex },
      { buffer: readBuffer, bytesPerRow: width * 4 },
      [width, height]
    );

    const gpuCommands = commandEncoder.finish();
    device.queue.submit([gpuCommands]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const data = new Uint8ClampedArray(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    const imageData = new ImageData(data, width, height);
    self.postMessage({ type: 'result', imageData }, { transfer: [imageData.data.buffer] });
  }
};
```

- [ ] **Step 2: Write the client wrapper**

```typescript
// src/lib/gpu/gpu-worker-client.ts
import GpuWorkerUrl from '@/workers/gpu.worker.ts?worker&url';

export class GpuResizeClient {
  private worker: Worker | null = null;

  async resize(bitmap: ImageBitmap, width: number, height: number): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        this.worker = new Worker(new URL(GpuWorkerUrl, import.meta.url), { type: 'module' });
      }

      this.worker.onmessage = (e) => {
        if (e.data.type === 'result') {
          resolve(e.data.imageData);
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.error));
        }
      };

      this.worker.onerror = reject;
      this.worker.postMessage({ type: 'resize', payload: { bitmap, width, height } }, { transfer: [bitmap] });
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
  }
}
```

- [ ] **Step 3: Write the test**

```typescript
// src/tests/unit/gpu-worker-client.test.ts
import { describe, it, expect } from 'vitest';
import { GpuResizeClient } from '../../lib/gpu/gpu-worker-client';

describe('GPU Worker Client', () => {
  it('can be instantiated', () => {
    const client = new GpuResizeClient();
    expect(client).toBeDefined();
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/workers/gpu.worker.ts src/lib/gpu/gpu-worker-client.ts src/tests/unit/gpu-worker-client.test.ts
git commit -m "feat: add GPU worker for async resize operations"
```

---

### Task 4: Integration with Existing Pipeline

**Files:**
- Modify: `src/workers/raster-encode.ts`
- Modify: `src/lib/hardware.ts`
- Test: `src/tests/integration/gpu-fallback.test.ts`

- [ ] **Step 1: Add GPU check to hardware probe**

Modify `src/lib/hardware.ts`:
```typescript
export interface HardwareCapabilities {
  webCodecsAv1: boolean;
  webGpu: boolean;
}

export async function probeHardwareSupport(): Promise<HardwareCapabilities> {
  // ... existing code ...
  
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const gpu = (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu;
      if (gpu) {
        const adapter = await gpu.requestAdapter();
        webGpu = !!adapter;
      }
    } catch {
      webGpu = false;
    }
  }

  return { webCodecsAv1, webGpu };
}
```

- [ ] **Step 2: Update raster-encode to use GPU when available**

```typescript
// In src/workers/raster-encode.ts
import { GpuResizeClient } from '@/lib/gpu/gpu-worker-client';
import { probeHardwareSupport } from '@/lib/hardware';

let gpuClient: GpuResizeClient | null = null;
let hardwareCaps: Awaited<ReturnType<typeof probeHardwareSupport>> | null = null;

export async function resizeImage(
  bitmap: ImageBitmap,
  width: number,
  height: number
): Promise<ImageData> {
  if (!hardwareCaps) {
    hardwareCaps = await probeHardwareSupport();
  }

  if (hardwareCaps.webGpu && !gpuClient) {
    gpuClient = new GpuResizeClient();
  }

  if (gpuClient) {
    try {
      return await gpuClient.resize(bitmap, width, height);
    } catch (e) {
      console.warn('GPU resize failed, falling back to CPU', e);
    }
  }

  // Fallback to OffscreenCanvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(bitmap, 0, 0, width, height);
  return ctx?.getImageData(0, 0, width, height)!;
}
```

- [ ] **Step 3: Write integration test**

```typescript
// src/tests/integration/gpu-fallback.test.ts
import { describe, it, expect, vi } from 'vitest';
import { resizeImage } from '../../workers/raster-encode';

describe('GPU Fallback', () => {
  it('falls back to CPU when GPU is unavailable', async () => {
    vi.stubGlobal('navigator', { gpu: undefined });
    
    const mockBitmap = {
      width: 100,
      height: 100,
    } as ImageBitmap;
    
    const result = await resizeImage(mockBitmap, 50, 50);
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/workers/raster-encode.ts src/lib/hardware.ts src/tests/integration/gpu-fallback.test.ts
git commit -m "feat: integrate GPU resize with CPU fallback in raster pipeline"
```

---

### Task 5: Performance Benchmark Suite

**Files:**
- Create: `src/tests/benchmarks/gpu-vs-cpu.bench.ts`
- Create: `scripts/benchmark-gpu.mjs`

- [ ] **Step 1: Write Vitest benchmark**

```typescript
// src/tests/benchmarks/gpu-vs-cpu.bench.ts
import { bench, describe } from 'vitest';
import { GpuResizeClient } from '../../lib/gpu/gpu-worker-client';

describe('GPU vs CPU Resize', () => {
  bench('GPU resize 4K → 1080p', async () => {
    const client = new GpuResizeClient();
    const bitmap = await createImageBitmap(new OffscreenCanvas(3840, 2160));
    await client.resize(bitmap, 1920, 1080);
    client.terminate();
  });

  bench('CPU resize 4K → 1080p', async () => {
    const canvas = new OffscreenCanvas(3840, 2160);
    const target = new OffscreenCanvas(1920, 1080);
    const ctx = target.getContext('2d');
    ctx?.drawImage(canvas, 0, 0, 1920, 1080);
  });
});
```

- [ ] **Step 2: Write Node benchmark script**

```javascript
// scripts/benchmark-gpu.mjs
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runBenchmark() {
  console.log('Running GPU vs CPU benchmark...');
  
  const iterations = 10;
  const gpuTimes = [];
  const cpuTimes = [];
  
  for (let i = 0; i < iterations; i++) {
    // Measure GPU
    const gpuStart = performance.now();
    await new Promise((resolve) => {
      const worker = new Worker(join(__dirname, '../src/workers/gpu.worker.ts'));
      worker.onmessage = () => {
        gpuTimes.push(performance.now() - gpuStart);
        worker.terminate();
        resolve();
      };
    });
    
    // Measure CPU
    const cpuStart = performance.now();
    // ... CPU resize ...
    cpuTimes.push(performance.now() - cpuStart);
  }
  
  const gpuAvg = gpuTimes.reduce((a, b) => a + b) / gpuTimes.length;
  const cpuAvg = cpuTimes.reduce((a, b) => a + b) / cpuTimes.length;
  
  console.log(`GPU average: ${gpuAvg.toFixed(2)}ms`);
  console.log(`CPU average: ${cpuAvg.toFixed(2)}ms`);
  console.log(`Speedup: ${(cpuAvg / gpuAvg).toFixed(2)}x`);
}

runBenchmark();
```

- [ ] **Step 3: Commit**

```bash
git add src/tests/benchmarks/gpu-vs-cpu.bench.ts scripts/benchmark-gpu.mjs
git commit -m "test: add GPU vs CPU performance benchmark suite"
```
