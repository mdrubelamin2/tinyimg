# PLAN: Robust SVG Dimension Extraction in Worker

Fixing the `ReferenceError: DOMParser is not defined` using a battle-tested, dependency-optimized approach.

## Brainstorming & Selection
- **Option 1: resvg-wasm (Winner)**: We already use `resvg-wasm`. It's a high-quality Rust-based parser compiled to WASM. It provides `width` and `height` properties on the `Resvg` instance.
- **Option 2: linkdom**: High performance DOM for Workers. But it adds a new dependency.
- **Option 3: svgo AST**: We already use `svgo`. We could traverse the `svgo` result, but it's more code than just querying `resvg`.

**Decision**: Use `resvg-wasm`. It's already in the worker, highly robust, and matches our rendering engine exactly.

## Proposed Changes

### 🛠️ Core Worker Refinement

#### [MODIFY] [optimizer.worker.ts](file:///Volumes/Others/projects/tinyimg2/src/workers/optimizer.worker.ts)
- Initialize `Resvg` without scaling first to extract metadata.
- Query `resvg.width` and `resvg.height`.
- Use those values for the "Bias Logic" wrapper and the high-res rasterization render.

## Verification Plan

### Automated Tests
- Run `bun playwright test` to ensure basic flow isn't broken.

### Manual Verification
- Upload an SVG with an embedded raster image.
- Verify the "Bias Logic" correctly wraps it in a WebP-wrapped SVG if appropriate.
- Verify no `ReferenceError` appears in the console/worker stats.
