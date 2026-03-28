# Results Table Virtualization Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate blank rows during scrolling with 100+ items by implementing row virtualization.

**Root Cause:** With 100+ rows, all rows render simultaneously (no virtualization). When items change status, React re-renders all rows, causing render queue backup and visible blank rows during scroll.

**Architecture:** Add `@tanstack/react-virtual` for windowed rendering. React Compiler handles component memoization automatically - only need to optimize Zustand selector equality.

**Tech Stack:** @tanstack/react-virtual, Zustand shallow equality, React Compiler (already enabled).

---

### Task 1: Install Virtualization Library

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

Run: `npm install @tanstack/react-virtual`

Expected: Package added to dependencies.

- [ ] **Step 2: Verify installation**

Run: `npm list @tanstack/react-virtual`

Expected: Shows installed version.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @tanstack/react-virtual for table virtualization"
```

---

### Task 2: Optimize Zustand Selector (Skip React.memo - Compiler handles it)

**Files:**
- Modify: `src/components/results/ResultRow.tsx`

**Note:** React Compiler automatically memoizes components. We only need to optimize the selector to avoid unnecessary store subscriptions.

- [ ] **Step 1: Add selector memoization with shallow equality**

```typescript
// Add import at top
import { shallow } from 'zustand/shallow';

// Change line 21 from:
const item = useStore(useImageStore, (state) => state.items.get(id));

// To:
const item = useStore(
  useImageStore, 
  (state) => state.items.get(id),
  shallow
);
```

**Why:** React Compiler memoizes the component, but Zustand doesn't know when to skip re-renders. The `shallow` comparator prevents re-renders when the Map returns the same object reference.

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/results/ResultRow.tsx
git commit -m "perf: add shallow equality to Zustand selector"
```

---

### Task 3: Implement Virtual Scrolling in ResultsTable

**Files:**
- Modify: `src/components/ResultsTable.tsx`
- Create: `src/components/results/VirtualizedTableBody.tsx`

**Note:** React Compiler auto-memoizes this component too - no manual memo needed.

- [ ] **Step 1: Create virtualized body component**

```typescript
// src/components/results/VirtualizedTableBody.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { ResultRow } from './ResultRow';
import type { ImageItem } from '@/lib/queue/types';

export interface VirtualizedTableBodyProps {
  itemIds: string[];
  onRemove: (id: string) => void;
  onPreview?: ((item: ImageItem, format: string) => void) | undefined;
}

export const VirtualizedTableBody = ({ 
  itemIds, 
  onRemove, 
  onPreview 
}: VirtualizedTableBodyProps) => {
  const parentRef = useRef<HTMLTableSectionElement>(null);
  
  const virtualizer = useVirtualizer({
    count: itemIds.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height in px
    overscan: 5, // Render 5 rows above/below viewport
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <tbody 
      ref={parentRef} 
      style={{ 
        display: 'block', 
        height: `${virtualizer.getTotalSize()}px`,
        overflow: 'auto'
      }}
    >
      {virtualRows.map(virtualRow => {
        const id = itemIds[virtualRow.index];
        return (
          <tr
            key={id}
            data-index={virtualRow.index}
            ref={(node) => virtualizer.measureElement(node)}
            style={{
              display: 'flex',
              position: 'absolute',
              transform: `translateY(${virtualRow.start}px)`,
              width: '100%',
            }}
          >
            <ResultRow id={id} onRemove={onRemove} onPreview={onPreview} />
          </tr>
        );
      })}
    </tbody>
  );
};
```

- [ ] **Step 2: Update ResultsTable to use virtualized body**

```typescript
// Modify src/components/ResultsTable.tsx

// Add import
import { VirtualizedTableBody } from './results/VirtualizedTableBody';

// Replace TableBody section:
// OLD:
// <TableBody className="divide-y divide-border/50 bg-surface/20">
//   {itemIds.map(id => (
//     <ResultRow key={id} id={id} onRemove={onRemoveItem} onPreview={onPreview} />
//   ))}
// </TableBody>

// NEW:
// <VirtualizedTableBody 
//   itemIds={itemIds} 
//   onRemove={onRemoveItem} 
//   onPreview={onPreview} 
// />

// Also add className to Table for proper styling:
// <Table className="text-left min-w-[700px]" aria-label="..." >
// Change to:
// <Table className="text-left min-w-[700px] block" aria-label="...">
```

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/results/VirtualizedTableBody.tsx src/components/ResultsTable.tsx
git commit -m "feat: implement virtual scrolling for results table"
```

---

### Task 4: Add Sticky Header Support

**Files:**
- Modify: `src/components/ResultsTable.tsx`
- Modify: `src/components/results/VirtualizedTableBody.tsx`

- [ ] **Step 1: Fix table structure for virtualization**

The current implementation has sticky header but virtualized body needs special handling.

```typescript
// Modify ResultsTable.tsx CardContent

// OLD:
// <CardContent className="p-0 overflow-x-auto">
//   <Table className="...">

// NEW:
<CardContent className="p-0 overflow-hidden">
  <div className="max-h-[600px] overflow-auto">
    <Table className="text-left min-w-[700px] block">
```

- [ ] **Step 2: Ensure header stays sticky**

```typescript
// TableHeader already has: className="... sticky top-0 z-10 ..."
// This should work with virtualized body, but verify:

// Add to VirtualizedTableBody tbody style:
<tbody 
  ref={parentRef} 
  style={{ 
    display: 'block', 
    height: `${virtualizer.getTotalSize()}px`,
    overflow: 'auto',
    contain: 'strict' // Improve scroll performance
  }}
>
```

- [ ] **Step 3: Test with 100+ items**

Manual test: Add 100+ images, scroll rapidly through table.

Expected: No blank rows, smooth scrolling at 60fps.

- [ ] **Step 4: Commit**

```bash
git add src/components/ResultsTable.tsx src/components/results/VirtualizedTableBody.tsx
git commit -m "fix: ensure sticky header works with virtualized body"
```

---

### Task 5: Performance Testing & Benchmarking

**Files:**
- Create: `src/tests/perf/table-scroll.perf.ts`

- [ ] **Step 1: Create performance test**

```typescript
// src/tests/perf/table-scroll.perf.ts
import { test, expect } from '@playwright/test';

test.describe('Results Table Performance', () => {
  test('should scroll 100 items without blank rows', async ({ page }) => {
    await page.goto('/');
    
    // Upload 100 test images
    // (would need test image batch)
    
    // Scroll rapidly
    await page.evaluate(() => {
      const table = document.querySelector('table');
      if (table) {
        table.parentElement?.scrollTo({ top: 1000, behavior: 'auto' });
        table.parentElement?.scrollTo({ top: 0, behavior: 'auto' });
        table.parentElement?.scrollTo({ top: 2000, behavior: 'auto' });
      }
    });
    
    // Check for blank rows (rows without content)
    const blankRows = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      let blankCount = 0;
      rows.forEach(row => {
        const text = row.textContent?.trim();
        if (!text || text.length < 5) blankCount++;
      });
      return blankCount;
    });
    
    expect(blankRows).toBe(0);
  });
});
```

- [ ] **Step 2: Run performance test**

Run: `npm run test:e2e -- src/tests/perf/table-scroll.perf.ts`

Expected: Test passes.

- [ ] **Step 3: Commit**

```bash
git add src/tests/perf/table-scroll.perf.ts
git commit -m "test: add performance test for table scroll with 100+ items"
```

---

### Success Criteria

- [ ] No blank rows visible during rapid scroll with 100+ items
- [ ] Scroll performance maintains 60fps (can verify with Chrome DevTools)
- [ ] Memory usage stable (no leaks from virtualization)
- [ ] All existing unit tests still pass
- [ ] E2E tests pass
