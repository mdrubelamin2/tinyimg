# PLAN: Orchestrated Audit & Final Polish

Audit conducted by specialized agents (Explorer, Performance Optimizer, Security Auditor, Frontend Specialist). The goal is to elevate "TinyIMG" from a functional MVP to an "Industrial Grade" production tool.

## Specialist Findings & Proposed Fixes

---

### 🚀 Performance & Memory (performance-optimizer)
- [ ] **Hardware-Aware Concurrency**: Update `QueueProcessor` to use `navigator.hardwareConcurrency` (clamped to 4) to optimize worker count based on the user's machine.
- [ ] **Memory Leak Prevention**: Implement automatic `URL.revokeObjectURL` for both single downloads and ZIP generation.
- [ ] **Worker Prefetch**: Ensure WASM buffers are prefetched/cached more aggressively in the worker.

### 🛡️ Security & Resilience (security-auditor)
- [x] ~~**Proxy Origin Guard**~~ **N/A:** Remote URL ingestion and the Cloudflare image proxy were removed; the app is static-only.
- [ ] **Error Boundary**: Add a React Error Boundary around the `FileTable` to prevent one corrupted item from crashing the whole UI.
- [ ] **Size Limit Feedback**: Improve the UI feedback when a 25MB limit is hit (vibrate/shake animation on the table row).

### 🎨 Logic & SOLID (backend-specialist / frontend-specialist)
- [ ] **Type Safety**: Address remaining `as any` casts in `optimizer.worker.ts` and `queue-processor.ts` with proper types for `@jsquash` and `@resvg`.
- [ ] **Cleaner State**: Move the saving calculation logic into a dedicated selector or hook to keep `App.tsx` lean.
- [ ] **Progressive UI**: Add a "Clear Finished" button to the queue actions to help users manage large batches.

---

## Deliverables

1.  **[MODIFY] [queue-processor.ts](file:///Volumes/Others/projects/tinyimg2/src/lib/queue-processor.ts)**: Memory management & hardware-aware concurrency.
2.  **[MODIFY] [optimizer.worker.ts](file:///Volumes/Others/projects/tinyimg2/src/workers/optimizer.worker.ts)**: Type safety and better WASM handling.
3.  **[MODIFY] [App.tsx](file:///Volumes/Others/projects/tinyimg2/src/App.tsx)**: UI polish and action buttons.
4.  ~~**[MODIFY] proxy/index.ts**~~ **Removed** with URL ingestion feature.
5.  **[MODIFY] [walkthrough.md](file:///Users/rubel-amin/.gemini/antigravity/brain/07aa8a30-e31b-41f2-b7e8-194642b34e27/walkthrough.md)**: Final feature sync.

---

## Verification Plan

### Automated
- `bun playwright test`: Verify new "Clear Finished" button and basic regression.
- `bun test`: Verify core logic remains intact.

### Manual
- **Memory Profile**: Open Chrome DevTools Memory tab, drop 20 files, optimize, clear, and verify Heap size returns to baseline.
- **Hardware Profile**: Verify on a mobile device (low cores) vs Desktop (high cores).
