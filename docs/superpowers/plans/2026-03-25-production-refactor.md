# TinyIMG Production Refactor & URL Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a maintainable, modular production codebase aligned with `docs/IMPLEMENTATION-MAP.md`, remove all remote-URL ingestion (no proxy, no `addUrls`), and preserve acceptance criteria in `docs/ACCEPTANCE-CRITERIA.md` (E2E + quality gates).

**Architecture:** Keep the proven stack (Vite 8, React 19, jsquash codecs, dedicated `optimizer.worker.ts`, `WorkerPool`) and **evolve** toward the domain split already documented: queue state vs intake vs scheduling vs results vs download. Avoid a literal blank-slate rewrite that would invalidate SSIM/PSNR baselines and regress WASM tuning.

**Tech Stack:** TypeScript, Vite, React 19, Vitest, Playwright, Node quality scripts (`scripts/quality-gate*.mjs`), Cloudflare Pages–style static deploy (no URL proxy required after this change).

---

## 1. Web research synthesis (2025–2026)

| Topic | Finding | Implication for TinyIMG |
|--------|-----------|---------------------------|
| **Browser image tooling** | Squoosh / jsquash family remains the standard for WASM codecs in-browser; privacy story is “no upload.” | Current dependency choices are industry-aligned; no need to swap codecs for “modernity.” |
| **Workers + Vite** | `worker: { format: 'es' }` + `new URL(..., import.meta.url)` is the standard Vite pattern; optional **Comlink** reduces boilerplate but adds a dependency and indirection. | Keep raw `postMessage` in `WorkerPool` unless message volume becomes unmaintainable. |
| **COOP/COEP** | SharedArrayBuffer / some WASM paths benefit from cross-origin isolation. | Only add headers if a future dependency requires SAB; current pipeline works without—**do not add** unless measured need. |
| **Server-side fetch of user URLs** | Requires a proxy (CORS), SSRF review, and ongoing ops. | **Removing URL input** eliminates an entire attack surface and the need to deploy/maintain `proxy/`. |

---

## 2. Current codebase analysis

### Strengths

- **Clear separation** between UI (`App.tsx`), orchestration (`QueueProcessor`), intake (`queue-intake.ts`), results (`queue-results.ts`), and heavy work (`workers/*`).
- **Quality bar** is encoded: E2E → `test-output/` → Node SSIM/PSNR + size vs `expected.jsonc`.
- **Constants** are largely centralized in `constants.ts` (good direction for “no magic numbers”).

### Gaps vs `docs/IMPLEMENTATION-MAP.md`

The map names files like `queue-state.ts`, `queue-scheduler.ts`, `queue-input.ts`; the repo currently uses `queue-intake.ts`, `queue-item.ts`, `queue-results.ts`, and a monolithic `QueueProcessor`. **The refactor is primarily a rename/split to match documented boundaries**, not a new product design.

### URL feature (removal scope)

| Location | Action |
|----------|--------|
| `src/lib/queue-processor.ts` | Remove `DEFAULT_PROXY_URL`, `proxyUrl`, `addUrls()`, import of `collectItemsFromUrls`. |
| `src/lib/queue/queue-intake.ts` | Remove `collectItemsFromUrls` entirely. |
| `src/constants.ts` | Remove `ERR_REMOTE_FILE_LIMIT` if unused after removal. |
| `src/lib/errors.ts` | Remove `RemoteErrors`, `REMOTE_FILE_LIMIT` from `AppErrorCode`. |
| `src/components/Dropzone.tsx` | Delete commented “Add via URL” block. |
| `proxy/index.ts` | Remove **or** move to `docs/archive/` with a note “deprecated with URL feature” (prefer **delete** to avoid confusion). |
| `README.md`, `docs/CLOUDFLARE-DEPLOYMENT.md`, `docs/IMPLEMENTATION-MAP.md`, `docs/AUDIT-*.md` | Update references to `addUrls`, `VITE_PROXY_URL`, proxy deployment. |

**Note:** `URL.createObjectURL` / `revokeObjectURL` for **local** blobs stay—they are not the “URL input” feature.

---

## 3. Approaches (choose one)

### Approach A — Incremental domain extraction (recommended)

**What:** Implement `IMPLEMENTATION-MAP.md` by extracting pure functions and thin classes, one vertical slice at a time; keep `QueueProcessor` as the façade until internals stabilize.

**Pros:** Lowest regression risk; tests stay green; aligns with DRY/KISS.  
**Cons:** Temporary duplication until extraction completes.

### Approach B — Package split (`packages/app`, `packages/core`)

**What:** Publish-style boundaries for hypothetical reuse.

**Pros:** Hard boundaries.  
**Cons:** Overkill for a single SPA; more tooling noise for “zero cost” static hosting.

### Approach C — Greenfield rewrite

**What:** New `src/` tree from scratch, port tests after.

**Pros:** Clean git history feel.  
**Cons:** High risk to WASM thresholds, flaky quality gates, long integration tail—**not recommended** for a release candidate.

**Recommendation:** **Approach A**, with explicit milestones and `npm run test:full` after each milestone.

---

## 4. Target module layout (post-refactor)

```
src/lib/
  queue/
    queue-state.ts       # immutable transitions / snapshots (optional if logic stays small)
    queue-input.ts       # rename/split from queue-intake.ts (files + ZIP only)
    queue-scheduler.ts   # processNext + format task list
    queue-result.ts      # merge/rename from queue-results.ts
    queue-item.ts        # keep / merge with factory concerns
  queue-processor.ts     # façade only: wires pool + queue modules + download
  worker-pool.ts
  download.ts
  validation.ts
src/workers/             # unchanged surface unless profiling demands splits
```

Names should follow **one** convention: either adopt map names exactly or update `IMPLEMENTATION-MAP.md` to match code—**do not** leave doc and code diverged.

---

## 5. Verification (before claiming “done”)

Per `superpowers:verification-before-completion`:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test`
4. `npm run test:e2e` (and `test:e2e:benchmark` if part of release CI)
5. `npm run test:quality` (after E2E produces `test-output/`)

---

## 6. Implementation tasks

### Task 0: Remove URL ingestion and proxy surface

**Files:**

- Modify: `src/lib/queue-processor.ts`
- Modify: `src/lib/queue/queue-intake.ts`
- Modify: `src/constants.ts`
- Modify: `src/lib/errors.ts`
- Modify: `src/components/Dropzone.tsx`
- Delete or archive: `proxy/index.ts`
- Modify: `README.md`, `docs/CLOUDFLARE-DEPLOYMENT.md`, `docs/IMPLEMENTATION-MAP.md`

- [x] **Step 1:** Remove `collectItemsFromUrls` and all callers; strip proxy fields and `addUrls` from `QueueProcessor`.
- [x] **Step 2:** Remove `ERR_REMOTE_FILE_LIMIT` and `RemoteErrors` / `REMOTE_FILE_LIMIT` code paths; run `npm run typecheck`.
- [x] **Step 3:** Clean `Dropzone.tsx` commented block; delete `proxy/index.ts` or document archival.
- [x] **Step 4:** Update docs to state **file/ZIP/folder only**; remove `VITE_PROXY_URL` from README/deploy docs.
- [ ] **Step 5:** Commit: `chore: remove remote URL ingestion and image proxy`

---

### Task 1: Align `QueueProcessor` with scheduler extraction

**Files:**

- Create: `src/lib/queue/queue-scheduler.ts` (or equivalent name from map)
- Modify: `src/lib/queue-processor.ts`

- [ ] **Step 1:** Move `processNext` and task-enqueue logic into scheduler module; unit-test edge cases (empty queue, all terminal).
- [ ] **Step 2:** Run `npm run test` and manual smoke `npm run dev`.

---

### Task 2: Consolidate intake naming (`queue-input`)

**Files:**

- Rename or create: `src/lib/queue/queue-input.ts` from `queue-intake.ts`
- Update imports across codebase

- [ ] **Step 1:** Rename file and fix imports (TypeScript path-safe).
- [ ] **Step 2:** Update `IMPLEMENTATION-MAP.md` if filenames differ from map.

---

### Task 3: Results module naming parity

**Files:**

- Optional rename: `queue-results.ts` → `queue-result.ts` per map

- [ ] **Step 1:** Rename + update tests.
- [ ] **Step 2:** `npm run test`

---

### Task 4: Documentation pass for production

**Files:**

- `README.md`, `docs/AUDIT-REPORT.md` (proxy/URL sections), `docs/PLAN-tinyimg-enhancements.md` if referenced

- [ ] **Step 1:** Single source of truth: supported inputs, limits, no server upload, deploy = static only.
- [ ] **Step 2:** Remove stale “addUrls” sequence diagrams from audit docs.

---

## 7. Open decisions (confirm with maintainer)

1. **Proxy folder:** Delete entirely vs. archive under `docs/` for historical deploy notes.
2. **Scope of “complete refactor”:** Does “from scratch” mean **Approach A through Task 4** only, or also splitting `optimizer.worker.ts` further? Default: **no worker split** unless profiling shows a hotspot.

---

## 8. Execution handoff

Plan saved to `docs/superpowers/plans/2026-03-25-production-refactor.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — one subagent per task, review between tasks (`superpowers:subagent-driven-development`).
2. **Inline execution** — same session, checkpoints (`superpowers:executing-plans`).

Specify which approach to use when starting implementation.
