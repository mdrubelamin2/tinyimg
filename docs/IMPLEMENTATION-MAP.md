# Implementation Map (Go-Live Overhaul)

This map defines the concrete module boundaries used by the production overhaul.
It is the implementation reference for incremental refactors without blind rewrites.

## Domain boundaries

### Queue domain (`src/lib/queue/`)

- `queue-state.ts`
  - Owns queue mutations, item lifecycle transitions, and queue snapshots.
  - No IO, no worker knowledge.
- `queue-item-factory.ts`
  - Creates normalized `ImageItem` instances.
  - Handles id generation, preview URL lifecycle hooks, and default result states.
- `queue-input.ts`
  - File and ZIP intake (folders via DataTransfer).
  - Validation, size checks, MIME/magic-byte checks, directory traversal parity.
- `queue-scheduler.ts`
  - Selects pending work and dispatches task envelopes to worker pool.
  - No UI updates; pure orchestration decisions.
- `queue-result.ts`
  - Applies worker success/error payloads to queue state.
  - Handles object URL replacement/revoke behavior for per-format results.
- `queue-download.ts`
  - Batch download orchestration using existing `download.ts`.
  - Enforces batch caps and fail-fast guards.

### Existing infrastructure (`src/lib/`)

- `worker-pool.ts`
  - Keep as worker execution primitive.
  - Accepts task objects and emits message/error events.
- `validation.ts`
  - Keep as content validation primitive.
  - Used by queue input and ZIP intake paths.
- `download.ts`
  - Keep as download primitive.
  - Queue domain uses this module, not direct ZIP logic elsewhere.

### Worker domain (`src/workers/`)

- Keep split between `optimizer.worker.ts`, `raster-encode.ts`, `svg-pipeline.ts`, `classify.ts`, `optimizer-wasm.ts`.
- Add no new orchestration logic in worker entrypoint beyond request routing and timeout policy.

### UI domain (`src/components/`)

- `ConfigPanel.tsx`, `ResultsTable.tsx`, `Dropzone.tsx`
  - Migrate to shared shadcn primitives.
  - Retain behavior contracts with queue API.
- `src/components/ui/*`
  - New reusable primitives (button, card, table, checkbox, select, badge, etc).

## Ownership matrix

- Queue API public surface: `QueueProcessor` (`src/lib/queue-processor.ts`)
  - Stable methods: `addFiles`, `updateOptions`, `removeItem`, `clearFinished`, `clear`, `downloadAll`.
  - Internal logic delegated to queue domain modules.
- UI should never call `worker-pool` or `validation` directly.
- Worker code should never mutate queue state shape.

## Test mapping

### Unit tests (Vitest target)

- `src/tests/classify.test.ts`
  - Worker classification invariants.
- `src/tests/validation.test.ts`
  - Magic-byte and zip-size guards.
- `src/tests/queue-processor.test.ts` (new)
  - Queue API behavior and regression checks:
    - status transitions
    - remove/clear behavior
    - updateOptions reset behavior
    - directory + ZIP validation parity

### Integration tests

- `src/tests/worker-pool.test.ts` (new)
  - Task dispatch ordering and callback behavior with mocked workers.

### E2E/quality

- Existing Playwright flow remains release gate:
  - `src/tests/e2e/basic.spec.ts`
  - `src/tests/e2e/benchmarking.spec.ts`
- Existing quality scripts remain post-E2E quality checks:
  - `scripts/quality-gate.mjs`
  - `scripts/quality-gate-svg.mjs`

## Sequence of refactor application

1. Introduce queue domain modules behind existing `QueueProcessor` API.
2. Move behavior unit-by-unit with no public API break.
3. Add queue-focused tests around migrated logic.
4. Migrate UI to shadcn primitives after queue API is stable.
5. Finalize docs/CI/release gates.

