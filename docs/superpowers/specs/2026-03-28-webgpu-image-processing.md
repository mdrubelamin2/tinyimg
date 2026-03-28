# WebGPU Image Processing Pipeline

## Goal
Replace CPU-bound `OffscreenCanvas` image resizing and color-space conversion with GPU-accelerated WebGPU compute shaders for parallel pixel operations.

## Background
Currently, TinyIMG resizes images and converts color spaces using the CPU via `OffscreenCanvas` 2D context inside web workers. This is slow for large images and doesn't leverage the user's dedicated GPU.

## Architecture

### 1. WebGPU Compute Engine (`src/lib/gpu/compute.ts`)
A new module that handles all WebGPU operations:

**Initialization:**
- Probe for `navigator.gpu.requestAdapter()`
- Request `GPUDevice` with appropriate limits
- Create persistent compute pipeline for resize operations
- Fall back to `OffscreenCanvas` if WebGPU unavailable

**Compute Shaders (WGSL):**
```wgsl
// Bilinear downscale compute shader
@group(0) @binding(0) var inputTex: texture_2d<f32>;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn resizeMain(@builtin(global_invocation_id) id: vec3<u32>) {
    // Sample 4 neighboring pixels from input
    // Apply bilinear interpolation
    // Write to output texture
}
```

### 2. Resize Operations (`src/lib/gpu/resize.ts`)
High-level API for image resizing:
- `resizeImage(bitmap: ImageBitmap, width: number, height: number): Promise<ImageData>`
- Supports bilinear and bicubic filtering
- Automatic workgroup size calculation

### 3. Color Space Conversion (`src/lib/gpu/color-space.ts`)
RGB to YUV420 conversion for AVIF/WebP encoding pre-processing:
- High-precision floating-point conversion
- BT.709 color matrix
- Chroma subsampling (4:2:0)

### 4. Worker Integration (`src/workers/gpu-worker.ts`)
Dedicated worker for GPU operations:
- WebGPU context must be created inside worker
- Transferable `ImageBitmap` input/output
- Message-based API for main thread

## Data Flow

```
┌─────────────┐
│ ImageBitmap │
└──────┬──────┘
       │ (transferred to GPU worker)
       ▼
┌──────────────────────┐
│  Upload to GPUTexture│
│  (GPUBuffer → Texture)│
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Run Compute Shader  │
│  (WGSL resize kernel)│
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│  Readback to Buffer  │
│  (Texture → Buffer)  │
└──────┬───────────────┘
       │ (transferred back)
       ▼
┌─────────────┐
│  ImageData  │
└─────────────┘
```

## Performance Targets

| Operation | CPU (Current) | WebGPU (Target) |
|-----------|--------------|-----------------|
| 4K → 1080p resize | ~150ms | ~15ms |
| RGB → YUV420 | ~80ms | ~8ms |
| Total pipeline | ~230ms | ~23ms |

**Target:** 10x speedup for resize operations on devices with discrete GPU.

## Browser Support

| Browser | WebGPU Support | Fallback |
|---------|---------------|----------|
| Chrome 113+ | ✅ Full | OffscreenCanvas |
| Edge 113+ | ✅ Full | OffscreenCanvas |
| Firefox Nightly | ⚠️ Flagged | OffscreenCanvas |
| Safari TP | ⚠️ Partial | OffscreenCanvas |

## Risks & Mitigations

### 1. Memory Limits
**Risk:** GPU texture allocation can fail on low-end devices.
**Mitigation:** 
- Query `GPUDevice.limits.maxTextureDimension2D`
- Fall back to CPU for images > 8192px
- Use `GPUAdapter.limits` for conservative sizing

### 2. Readback Latency
**Risk:** Copying `GPUBuffer` → CPU can be slow.
**Mitigation:**
- Use `GPUMapMode.READ` with async mapping
- Batch multiple operations before readback
- Keep data on GPU for chained operations

### 3. Worker Context Loss
**Risk:** WebGPU context may be lost if worker terminates.
**Mitigation:**
- Re-initialize device on `contextlost` event
- Queue operations during re-initialization
- Graceful degradation to CPU path

## Open Questions

1. **Shader Variants:** Should we compile multiple WGSL shaders (bilinear, bicubic, lanczos) or use runtime branching?
2. **Memory Pooling:** Should we pool `GPUBuffer` allocations to reduce GC pressure?
3. **Precision:** Use `f32` (full precision) or `f16` (faster, less memory)?

## Success Criteria

- [ ] All existing tests pass with WebGPU path enabled
- [ ] Benchmark shows 5x+ speedup on resize operations (discrete GPU)
- [ ] Graceful fallback to CPU on unsupported browsers
- [ ] No memory leaks after 100+ consecutive operations
- [ ] Worker remains responsive during GPU operations
