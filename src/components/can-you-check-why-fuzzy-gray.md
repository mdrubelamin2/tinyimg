# Plan: Fix "Apply to all" settings update and processing stall

The "Apply to all" functionality currently resets image state but fails to restart processing because it doesn't clean up in-flight task tracking (`inFlightRowIds`, `largeFileInFlight`) or abort existing worker tasks. This leads to a stalled queue and potential state corruption from "zombie" worker results.

## Context

When a user clicks "Apply to all" in `ConfigPanel.tsx`, the application should:

1. Update global settings.
2. Abort all current processing for existing images.
3. Reset image statuses and results based on new settings.
4. Restart the processing queue with the new settings.

Currently, step 2 and part of step 3 (clearing tracking state) are missing.

## Proposed Changes

### `src/store/image-store.ts`

- Modify `applyGlobalOptionsImpl` to:
  - Access the `WorkerPool`.
  - For each item being reset:
    - Call `pool.abortInFlightForItem(id)` to stop active workers.
    - Call `pool.removeTasksForItem(id)` to clear queued tasks.
    - Remove the item ID from `inFlightRowIds`.
    - Call `revokeResultUrls(item)` to prevent memory leaks.
    - Call `deleteItemPayloads(id)` to clean up old binary data.
  - Recompute `largeFileInFlight` flag after clearing `inFlightRowIds`.
  - Ensure these updates happen inside a `batch` for atomicity.

## Critical Files

- [src/store/image-store.ts](src/store/image-store.ts)
- [src/workers/worker-pool-v2.ts](src/workers/worker-pool-v2.ts) (for reference of abortion methods)

## Verification Plan

### Automated Tests

- If there are existing unit tests for `image-store.ts`, run them: `npm test` or `vitest`. (I will check for tests first).

### Manual Verification

1. Open the application.
2. Drop multiple images.
3. While images are processing, change a setting (e.g., toggle "Include Original") and click "Apply to All".
4. **Expected Behavior**:
   - Active processing should stop immediately.
   - Progress bars should reset to 0.
   - Images should start processing again with the new configuration.
   - No "zombie" results from the previous run should appear.
5. Drop a new image to ensure the queue still works.
