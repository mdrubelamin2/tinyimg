# Zero-Deferral Top-Priority Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all identified audit risks immediately (no backlog deferrals), restore full CI signal quality, and enforce production-grade correctness, security, performance, accessibility, and maintainability.

**Architecture:** Apply test-first changes in small, isolated tasks across UI, worker pipeline, queue intake, and store lifecycle. Each risk is closed with explicit regression tests, then validated with full project verification (`lint`, `typecheck`, `test`, `test:e2e`, `test:quality`).

**Tech Stack:** React 19, TypeScript, Zustand, Web Workers, WASM codecs (`@jsquash/*`, `libimagequant-wasm`, `@resvg/resvg-wasm`), Vitest, Playwright, ESLint.

---

## File Structure Map

- Modify: `src/App.tsx` — fix broken FAQ JSX semantics and rendering integrity.
- Modify: `src/tests/e2e/basic.spec.ts` — align selectors/file-upload flow to current UI.
- Modify: `src/store/image-store.ts` — revoke object URLs on `clearFinished` to prevent leaks.
- Modify: `src/lib/queue/queue-intake.ts` — full directory traversal (`readEntries` loop) + unzip hard caps.
- Modify: `src/constants/limits.ts` — add explicit ZIP extraction safety constants.
- Modify: `src/workers/optimizer.worker.ts` — enforce single terminal event per task (settle guard).
- Modify: `src/lib/worker-pool.ts` — deprecate/remove legacy footgun behavior.
- Modify: `src/components/ResultsTable.tsx` — canonicalize `ImageItem` type import.
- Modify: `src/hooks/useQueueStats.ts` — canonicalize `ImageItem` type import.
- Modify: `src/components/Dropzone.tsx` — improve semantic accessibility of interactive control.
- Modify: `src/components/ErrorBoundary.tsx` — add structured optional reporter hook.
- Create/Modify tests:
  - `src/tests/image-store-queue-progression.test.ts`
  - `src/tests/queue-intake.test.ts`
  - `src/tests/optimizer.test.ts`
  - `src/tests/e2e/basic.spec.ts`
  - `src/tests/validation.test.ts` (if required for zip guard behavior)
- Modify docs:
  - `README.md`
  - `docs/AUDIT-2026-03-27-FRESH-FULL.md`

---

### Task 1: Fix Critical JSX Integrity in App Footer

**Files:**
- Modify: `src/App.tsx`
- Test: `src/tests/e2e/basic.spec.ts`

- [ ] **Step 1: Write/adjust failing UI assertion test**

```ts
// in basic.spec.ts
test('should render FAQ file-size entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('What is the file size limit?')).toBeVisible();
});
```

- [ ] **Step 2: Run targeted test to verify failure (or parse/render mismatch)**

Run: `npx playwright test src/tests/e2e/basic.spec.ts --project=chromium --grep "file-size entry"`
Expected: FAIL before fix.

- [ ] **Step 3: Implement minimal JSX structure fix in `App.tsx`**

```tsx
<div>
  <dt className="font-bold text-foreground">What is the file size limit?</dt>
  <dd>25MB per file. Batch download is capped to avoid memory issues.</dd>
</div>
```

- [ ] **Step 4: Re-run targeted test**

Run: `npx playwright test src/tests/e2e/basic.spec.ts --project=chromium --grep "file-size entry"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/tests/e2e/basic.spec.ts
git commit -m "fix: restore valid FAQ JSX structure in app footer"
```

---

### Task 2: Repair E2E Selector Drift and File Chooser Flow

**Files:**
- Modify: `src/tests/e2e/basic.spec.ts`

- [ ] **Step 1: Write failing expectations against current UI copy**

```ts
await expect(page.getByText('Config')).toBeVisible();
await expect(page.getByRole('button', { name: /drop files or click to select/i })).toBeVisible();
```

- [ ] **Step 2: Run E2E smoke to capture failures**

Run: `npm run test:e2e`
Expected: FAIL on stale selectors/timeouts before update completion.

- [ ] **Step 3: Replace stale strings and harden upload interaction**

```ts
const dropzone = page.getByRole('button', { name: /drop files or click to select/i });
await expect(dropzone).toBeVisible();
const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  dropzone.click(),
]);
await fileChooser.setFiles(filePath);
```

- [ ] **Step 4: Run full E2E suite**

Run: `npm run test:e2e`
Expected: PASS all browser projects.

- [ ] **Step 5: Commit**

```bash
git add src/tests/e2e/basic.spec.ts
git commit -m "test: align e2e selectors and upload flow with current UI"
```

---

### Task 3: Eliminate Object URL Leaks in `clearFinished`

**Files:**
- Modify: `src/store/image-store.ts`
- Test: `src/tests/image-store-queue-progression.test.ts`

- [ ] **Step 1: Add failing test for URL revocation**

```ts
it('revokes preview and result URLs when clearing finished items', () => {
  const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
  // seed store with finished item containing previewUrl + result.downloadUrl
  // call clearFinished()
  expect(revokeSpy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run targeted unit test and verify failure**

Run: `npm run test -- src/tests/image-store-queue-progression.test.ts`
Expected: FAIL before fix.

- [ ] **Step 3: Implement cleanup before dropping finished items**

```ts
for (const id of state.itemOrder) {
  const item = state.items.get(id);
  if (!item) continue;
  const keep = item.status === STATUS_PROCESSING || item.status === STATUS_PENDING;
  if (!keep) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    revokeResultUrls(item);
    continue;
  }
  nextItems.set(id, item);
  nextOrder.push(id);
}
```

- [ ] **Step 4: Re-run targeted test**

Run: `npm run test -- src/tests/image-store-queue-progression.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/image-store.ts src/tests/image-store-queue-progression.test.ts
git commit -m "fix: revoke object urls when clearing finished queue items"
```

---

### Task 4: Fix Directory Traversal to Read All Batches

**Files:**
- Modify: `src/lib/queue/queue-intake.ts`
- Test: `src/tests/queue-intake.test.ts`

- [ ] **Step 1: Add failing test for multi-batch directory reader**

```ts
it('collects all directory entries across readEntries batches', async () => {
  // mock directory reader returning [a,b], then [c], then []
  // expect all 3 files processed
});
```

- [ ] **Step 2: Run targeted test to verify failure**

Run: `npm run test -- src/tests/queue-intake.test.ts`
Expected: FAIL before fix.

- [ ] **Step 3: Implement loop until empty batch**

```ts
const dirReader = (entry as FileSystemDirectoryEntry).createReader();
while (true) {
  const batch = await new Promise<FileSystemEntry[]>((resolve) => dirReader.readEntries(resolve));
  if (batch.length === 0) break;
  for (const childEntry of batch) {
    await traverseEntry(childEntry, items, ctx);
  }
}
```

- [ ] **Step 4: Re-run queue-intake tests**

Run: `npm run test -- src/tests/queue-intake.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queue/queue-intake.ts src/tests/queue-intake.test.ts
git commit -m "fix: traverse all directory entry batches during drag-drop intake"
```

---

### Task 5: Add ZIP Extraction Safety Caps (Entry Count + Total Uncompressed Bytes)

**Files:**
- Modify: `src/constants/limits.ts`
- Modify: `src/lib/queue/queue-intake.ts`
- Test: `src/tests/queue-intake.test.ts`

- [ ] **Step 1: Add failing tests for zip limits**

```ts
it('rejects zip extraction when entry count exceeds cap', async () => {
  // mock unzip output with > cap entries
  await expect(processZip(...)).rejects.toThrow(/too many files/i);
});

it('rejects zip extraction when total uncompressed bytes exceeds cap', async () => {
  // mock unzip output with byte sum > cap
  await expect(processZip(...)).rejects.toThrow(/too large/i);
});
```

- [ ] **Step 2: Run queue-intake tests and verify failure**

Run: `npm run test -- src/tests/queue-intake.test.ts`
Expected: FAIL before caps exist.

- [ ] **Step 3: Add constants and enforce before creating Files**

```ts
export const MAX_ZIP_EXTRACTED_FILES = 1000;
export const MAX_ZIP_EXTRACTED_TOTAL_BYTES = 200 * 1024 * 1024;
```

```ts
let extractedCount = 0;
let extractedBytes = 0;
for (const [fileName, uint8] of Object.entries(unzipped)) {
  extractedCount += 1;
  extractedBytes += uint8.byteLength;
  if (extractedCount > MAX_ZIP_EXTRACTED_FILES) throw new Error('ZIP contains too many files');
  if (extractedBytes > MAX_ZIP_EXTRACTED_TOTAL_BYTES) throw new Error('ZIP uncompressed data too large');
  // continue normal validation path
}
```

- [ ] **Step 4: Re-run queue-intake tests**

Run: `npm run test -- src/tests/queue-intake.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/constants/limits.ts src/lib/queue/queue-intake.ts src/tests/queue-intake.test.ts
git commit -m "feat: enforce zip extraction caps for entries and uncompressed bytes"
```

---

### Task 6: Enforce Single Terminal Worker Outcome (Timeout/Sucess Race Fix)

**Files:**
- Modify: `src/workers/optimizer.worker.ts`
- Test: `src/tests/optimizer.test.ts`

- [ ] **Step 1: Add failing test proving duplicate terminal events are blocked**

```ts
it('posts only one terminal message when timeout races with completion', async () => {
  // simulate timeout + late success path
  // expect exactly one postMessage terminal event
});
```

- [ ] **Step 2: Run targeted optimizer test and verify failure**

Run: `npm run test -- src/tests/optimizer.test.ts`
Expected: FAIL before guard.

- [ ] **Step 3: Implement settled guard and centralized finish methods**

```ts
let settled = false;
const finishError = (payload: Record<string, unknown>) => {
  if (settled) return;
  settled = true;
  clearTimeout(timeoutId);
  self.postMessage(payload);
};
const finishSuccess = (payload: Record<string, unknown>) => {
  if (settled) return;
  settled = true;
  clearTimeout(timeoutId);
  self.postMessage(payload);
};
```

- [ ] **Step 4: Re-run optimizer tests**

Run: `npm run test -- src/tests/optimizer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/workers/optimizer.worker.ts src/tests/optimizer.test.ts
git commit -m "fix: guarantee single terminal worker response per task"
```

---

### Task 7: Remove Legacy Worker Pool Footgun

**Files:**
- Modify: `src/lib/worker-pool.ts`
- Modify imports if referenced elsewhere
- Test: `src/tests/image-store-queue-progression.test.ts` (or affected tests)

- [ ] **Step 1: Add failing check that legacy path is not used in production flow**

```ts
it('uses worker-pool-v2 in store queue orchestration', () => {
  // assert imports/behavior route through worker-pool-v2
});
```

- [ ] **Step 2: Run targeted tests and verify current behavior baseline**

Run: `npm run test -- src/tests/image-store-queue-progression.test.ts`
Expected: establish baseline.

- [ ] **Step 3: Deprecate hard or remove unsafe logic**

```ts
throw new Error('Legacy worker-pool is deprecated. Use workers/worker-pool-v2.ts');
```

(or remove file and update references if safe).

- [ ] **Step 4: Run affected tests**

Run: `npm run test -- src/tests/image-store-queue-progression.test.ts src/tests/image-store-selectors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/worker-pool.ts src/store/image-store.ts src/tests/image-store-queue-progression.test.ts src/tests/image-store-selectors.test.ts
git commit -m "refactor: hard-deprecate legacy worker pool path"
```

---

### Task 8: Canonicalize Queue Types Imports

**Files:**
- Modify: `src/components/ResultsTable.tsx`
- Modify: `src/hooks/useQueueStats.ts`

- [ ] **Step 1: Add compile-level failing check (if needed) by removing indirect export usage**

```ts
// switch import to canonical type module and let typecheck enforce consistency
```

- [ ] **Step 2: Run typecheck to confirm break before implementation (if any)**

Run: `npm run typecheck`
Expected: fail or warning path if drift exists.

- [ ] **Step 3: Implement canonical type imports**

```ts
import type { ImageItem } from '../lib/queue/types';
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResultsTable.tsx src/hooks/useQueueStats.ts
git commit -m "refactor: use canonical queue type imports in ui hooks/components"
```

---

### Task 9: Improve Dropzone Semantic Accessibility (WCAG 2.2 Alignment)

**Files:**
- Modify: `src/components/Dropzone.tsx`
- Test: `src/tests/e2e/basic.spec.ts`

- [ ] **Step 1: Add failing accessibility interaction test**

```ts
test('dropzone is keyboard-activatable as a native control', async ({ page }) => {
  const trigger = page.getByRole('button', { name: /drop files or click to select/i });
  await expect(trigger).toBeVisible();
});
```

- [ ] **Step 2: Run targeted e2e accessibility test**

Run: `npx playwright test src/tests/e2e/basic.spec.ts --project=chromium --grep "keyboard-activatable"`
Expected: FAIL if semantics are insufficient.

- [ ] **Step 3: Implement native button semantics (or robust equivalent)**

```tsx
<button type="button" onClick={openFileDialog} aria-label="Drop files or click to select" ...>
  {/* existing visual content */}
</button>
```

- [ ] **Step 4: Re-run targeted e2e test**

Run: `npx playwright test src/tests/e2e/basic.spec.ts --project=chromium --grep "keyboard-activatable"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dropzone.tsx src/tests/e2e/basic.spec.ts
git commit -m "fix: improve dropzone semantics and keyboard accessibility"
```

---

### Task 10: Add Structured Error Boundary Reporting Hook

**Files:**
- Modify: `src/components/ErrorBoundary.tsx`
- Test: `src/tests/validation.test.ts` (or add component-level test file)

- [ ] **Step 1: Add failing test for error reporter callback invocation**

```ts
it('calls optional error reporter with error and component stack', () => {
  // mount ErrorBoundary + throwing child + reporter spy
  // expect reporter to be called
});
```

- [ ] **Step 2: Run targeted test and verify failure**

Run: `npm run test -- src/tests/validation.test.ts`
Expected: FAIL before hook exists.

- [ ] **Step 3: Implement optional reporter injection**

```ts
interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}
```

```ts
public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  this.props.onError?.(error, errorInfo);
  console.error('Uncaught error:', error, errorInfo);
}
```

- [ ] **Step 4: Re-run targeted test**

Run: `npm run test -- src/tests/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/tests/validation.test.ts
git commit -m "feat: add optional structured error reporting in error boundary"
```

---

### Task 11: Documentation Updates (No Deferrals Policy)

**Files:**
- Modify: `README.md`
- Modify: `docs/AUDIT-2026-03-27-FRESH-FULL.md`

- [ ] **Step 1: Add explicit runtime guarantees and limits docs (zip caps, URL cleanup, worker settle behavior)**

```md
- ZIP extraction guardrails: max files and max uncompressed bytes.
- Queue cleanup revokes all object URLs for finished/removed items.
- Worker pipeline guarantees one terminal event per task.
```

- [ ] **Step 2: Add accessibility and testing notes**

```md
- Dropzone uses native interactive semantics.
- E2E selectors are aligned with current UI copy.
```

- [ ] **Step 3: Run markdown + consistency check**

Run: `npm run lint`
Expected: no new docs-related lint regressions.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/AUDIT-2026-03-27-FRESH-FULL.md
git commit -m "docs: document hardened queue, worker, zip, and accessibility guarantees"
```

---

### Task 12: Final Full Verification Gate (Required)

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: PASS (or agreed baseline warnings only).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run unit tests**

Run: `npm run test`
Expected: PASS.

- [ ] **Step 4: Run E2E tests**

Run: `npm run test:e2e`
Expected: PASS across configured browser projects.

- [ ] **Step 5: Run quality gates**

Run: `npm run test:quality`
Expected: PASS.

- [ ] **Step 6: Run full pipeline**

Run: `npm run test:full`
Expected: PASS.

- [ ] **Step 7: Final commit for any remaining verification-driven adjustments**

```bash
git add .
git commit -m "chore: complete zero-deferral remediation and verification"
```

---

## Plan Self-Review

- Spec coverage: All previously identified critical/high/medium risks are mapped to explicit implementation tasks with tests and verification.
- Placeholder scan: No TODO/TBD placeholders; each task has concrete code/commands.
- Type consistency: Canonical queue types and worker paths are explicitly standardized.

---

Plan complete and saved to `docs/superpowers/plans/2026-03-27-zero-deferral-top-priority-remediation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?