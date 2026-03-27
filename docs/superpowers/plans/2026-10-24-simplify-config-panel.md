# Simplify Config Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Radically simplify the ConfigPanel UI and GlobalOptions model, keeping only output formats and SVG internal format, while adding an explicit "Apply to All" button.

**Architecture:** Remove removed fields from `GlobalOptions`, `TaskOptions`, and the UI. Hardcode the removed options (like SVG display/resvg, quality defaults) in the worker/pipeline layer. Disconnect auto-apply in `App.tsx` and move it to a manual button in `ConfigPanel.tsx`.

**Tech Stack:** React, Zustand, TypeScript

---

### Task 1: Clean up GlobalOptions and Types

**Files:**
- Modify: `src/constants/index.ts`
- Modify: `src/lib/queue/types.ts`
- Modify: `src/lib/queue-types.ts` (if exists and has duplicates)

- [ ] **Step 1: Remove unused fields from `GlobalOptions`**
  Remove `smallFilesFirst`, `outputQualityPercent`, `resizeMaxEdge`, `svgRasterizer`, `svgExportDensity`, `svgDisplayDpr` from `GlobalOptions` and `DEFAULT_GLOBAL_OPTIONS`.

- [ ] **Step 2: Update TaskOptions and ImageItem**
  Remove the same fields from `TaskOptions` in `src/lib/queue/types.ts`.
  Remove `qualityPercentOverride` from `ImageItem`.

### Task 2: Clean up Store and App orchestration

**Files:**
- Modify: `src/store/image-store.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update image-store**
  Remove `setItemQualityPercent` from store interface and implementation.
  In `_processNext`, hardcode small file sorting (or remove it), and pass hardcoded SVG/Quality values to `currentPool.addTask` `options` since they are no longer in `TaskOptions` (or remove them from `TaskOptions` and hardcode them inside the worker itself. Let's remove them from `TaskOptions` and hardcode inside the worker).
  Remove them from `getFormatsToProcess` or anywhere else they leak.

- [ ] **Step 2: Remove auto-apply from App.tsx**
  Remove the `useEffect` that listens to `options` and calls `handleOptionsChange()`.

### Task 3: Hardcode values in Workers

**Files:**
- Modify: `src/workers/optimizer.worker.ts`
- Modify: `src/workers/svg-pipeline.ts`
- Modify: `src/workers/raster-encode.ts` (if needed)

- [ ] **Step 1: Update worker options**
  Remove the removed fields from `OptimizeOptions` interface in `optimizer.worker.ts`.
  Pass hardcoded values (`svgExportDensity: 'display'`, `svgDisplayDpr: 2`, `svgRasterizer: 'resvg'`, `qualityPercent: 75`, `resizeMaxEdge: 0`) to the pipeline functions.

### Task 4: Simplify ConfigPanel UI

**Files:**
- Modify: `src/components/ConfigPanel.tsx`
- Delete: `src/components/config/QualitySlider.tsx`
- Delete: `src/components/config/ResizeControl.tsx`

- [ ] **Step 1: Remove dead UI components**
  Delete the slider and resize control components.

- [ ] **Step 2: Update ConfigPanel**
  Remove the Content-Aware Engine block.
  Remove QualitySlider and ResizeControl usages.
  Remove `svg-export-density`, `svg-display-dpr`, and `svg-rasterizer` selects.
  Add helper text to "SVG Internal Data": "Determines the embedded raster format used when SVGs are converted before optimization."
  Add "Apply to All" button next to "Reset to Default" or in that section. It should call `useImageStore(s => s.applyGlobalOptions)(options)`.

### Task 5: Fix Tests

**Files:**
- Modify: `src/tests/queue-results.test.ts`
- Modify: `src/tests/image-store-queue-progression.test.ts`

- [ ] **Step 1: Update mock TaskOptions in tests**
  Remove the deleted fields from the mocked `options` object in `applyWorkerTaskError` / `addTask` assertions.

