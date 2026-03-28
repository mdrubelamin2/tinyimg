# Design Spec: Ultra-Smooth UI 2026 for Large-Scale Image Processing

## 1. Problem Statement
When processing a large queue of files (100+ items, multiple output formats), the UI suffers from:
- **Scroll Jitter**: Synchronous store updates for every worker message trigger heavy React reconciliation during scroll events.
- **Main Thread Starvation**: Worker concurrency saturates all CPU cores, leaving no room for the browser's UI thread.
- **Urgent UI Updates**: Status changes and savings calculations are treated as urgent updates, blocking more critical user interactions like scrolling.

## 2. Future-Proof Architecture (2026+)

### 2.1 React 19 Concurrent Mode Integration
We will leverage React 19's `useTransition` and `useDeferredValue` to categorize UI updates:
- **Urgent Updates**: User scrolling, row deletion, and immediate UI feedback.
- **Non-Urgent Updates**: Status changes (Processing -> Success), savings calculations, and total counts.
- **Deferred Updates**: Global savings percentage and "Optimized" badge in the header.

### 2.2 Main-Thread Core Reservation (Core Offset)
To ensure the smoothest possible UI, we will implement a "Core Offset" strategy:
- **Logic**: `concurrency = Math.max(1, hardwareConcurrency - 1)`.
- **Reasoning**: Reserving one core for the browser's main thread is the industry best practice for high-concurrency web apps to maintain 60/120fps during background work.

### 2.3 Off-Main-Thread (OMT) Everything
The main thread should only be for rendering. All data processing moves to the worker:
- **Pre-formatted Results**: Workers will return `formattedSize` and `savingsPercent` as strings/numbers ready for display.
- **Pipeline Stage Timings**: Already computed in workers; will be passed through to ensure the main thread does zero math.

### 2.4 Micro-Batching & RequestIdleCallback (RIC)
- **Status Throttler**: Store updates for processing results will be micro-batched (16ms windows) and flushed using `requestIdleCallback` to avoid competing with frame-critical work.
- **Selective Map Updates**: We'll use a `subscription-per-row` model in the store to ensure updating one item doesn't trigger a re-render of the entire virtualized list.

## 3. Implementation Details

### 3.1 ResultsTable (Header)
- **Technique**: `useDeferredValue` for `savingsPercent` and `doneCount`.
- **Benefit**: The header stats can lag slightly behind the actual data to prioritize the list scroll.

### 3.2 VirtualizedTableBody & ResultRowCells
- **Technique**: `useTransition` for marking an item as "Success".
- **Benefit**: React can interrupt the status change render if the user scrolls.
- **LOD (Level of Detail)**: If the item is far from the viewport, we only update the minimal state needed, deferring heavy UI changes.

### 3.3 Worker Pool (v2)
- **Technique**: "View-Priority Queueing".
- **Logic**: Items currently visible in the `VirtualizedTableBody` are moved to the front of the `WorkerPool` task queue.

## 4. Success Criteria
- **Scroll Smoothness**: Stable 60fps (or 120fps on high-refresh displays) even when 8 files finish simultaneously.
- **Input Responsiveness**: < 50ms interaction latency during heavy processing.
- **Efficiency**: Zero redundant re-renders of off-screen list items.

## 5. Testing & Verification
- **Performance Profiling**: Using Chrome DevTools Performance tab to verify "Main Thread" idleness.
- **Large List Benchmark**: Processing 200+ files with 4 formats each (800+ total tasks).
- **Concurrent Scroll Test**: Manual scroll stress-test during peak processing.
