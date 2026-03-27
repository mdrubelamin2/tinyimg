# Architecture

High-level structure after production refactor. Constants and types are single source of truth; queue and worker are thin coordinators.

## Config and constants

- **`src/constants.ts`** — Limits (file size, download, concurrency, worker timeouts), status strings, formats, MIME map, error messages, default options. No magic values in application code.

## Main thread

- **`src/lib/queue-processor.ts`** — Orchestrator: stable public API for queue actions; delegates to queue modules.
- **`src/lib/queue-types.ts`** — Shared types: `ImageItem`, `ImageResult`, `Task`, `WorkerRequest`, `WorkerResponse`.
- **`src/lib/validation.ts`** — File and magic-byte validation; `validateFile`, `validateZipSize`, `checkMagicBytes`.
- **`src/lib/worker-pool.ts`** — Worker pool: task queue, assign tasks to workers, deliver messages/errors.
- **`src/lib/download.ts`** — Build ZIP from results, trigger download, revoke object URLs.

### Queue modules

- **`src/lib/queue/queue-item.ts`** — Item creation and format selection/reset behavior.
- **`src/lib/queue/queue-intake.ts`** — File, folder, and ZIP ingestion with validation parity.
- **`src/lib/queue/queue-results.ts`** — Worker message/error application to queue state.

## Worker

- **`src/workers/optimizer.worker.ts`** — Entry: message handler, timeout, branch SVG vs raster.
- **`src/workers/optimizer-wasm.ts`** — Resvg and libimagequant WASM init.
- **`src/workers/classify.ts`** — Content classification (photo vs graphic).
- **`src/workers/svg-pipeline.ts`** — SVG: SVGO → Resvg rasterize → encode → wrap or optimized.
- **`src/workers/raster-encode.ts`** — Presets, getImageData, checkPixelLimit, encode (AVIF/WebP/JPEG/PNG).

## UI

- **`src/App.tsx`** — Layout and composition; composes Dropzone, ConfigPanel, ResultsTable, AppHeader.
- **`src/hooks/useQueueStats.ts`** — Derive savings, all-done, has-finished from queue items.
- **`src/components/ResultsTable.tsx`** — Queue table, format chips, download links.
- **`src/components/AppHeader.tsx`** — Nav bar, logo, GitHub link.
- **`src/components/ui/*`** — Shared shadcn-pattern primitives (Button, Table, Card, Select, Checkbox, Badge).

## Tests and scripts

- **`src/tests/e2e/constants.ts`** — E2E timeouts and tolerance.
- **`src/tests/*.test.ts`** — Unit tests (Vitest).
- **`scripts/common.mjs`** — Shared paths and parseJSONC for quality-gate scripts.

## Running

- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Unit tests: `npm run test`
- E2E smoke: `npm run test:e2e` (Playwright + `vite preview` on port 5174)
- E2E benchmark: `npm run test:e2e:benchmark`
- Quality gates: `npm run test:quality`
