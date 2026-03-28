# SVG Classification & Adaptive Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a battle-tested SVG classification system (1,500 nodes / 5,000 segments) to automatically decide between Optimized Vector or Rasterized Wrapper output.

**Architecture:** Use a lightweight regex-based classifier in the SVG worker to avoid DOM overhead, followed by a conditional pipeline that either runs SVGO or `resvg-wasm` rasterization.

**Tech Stack:** TypeScript, SVGO v4, `resvg-wasm`, Web Workers.

---

### Task 1: Create the SVG Classifier Utility

**Files:**
- Create: `src/lib/optimizer/svg-classifier.ts`
- Test: `src/tests/svg-classifier.test.ts`

- [ ] **Step 1: Write the failing test for SVG classification**

```typescript
import { describe, it, expect } from 'vitest';
import { classifySvg } from '../lib/optimizer/svg-classifier';

describe('classifySvg', () => {
  it('should classify a simple icon as SIMPLE', () => {
    const simpleSvg = '<svg><circle cx="10" cy="10" r="5" /></svg>';
    expect(classifySvg(simpleSvg).type).toBe('SIMPLE');
  });

  it('should classify an SVG with an image as HYBRID', () => {
    const hybridSvg = '<svg><image href="data:image/png;base64,..." /></svg>';
    expect(classifySvg(hybridSvg).type).toBe('HYBRID');
  });

  it('should classify a dense SVG as COMPLEX', () => {
    const complexSvg = '<svg>' + '<rect />'.repeat(1600) + '</svg>';
    expect(classifySvg(complexSvg).type).toBe('COMPLEX');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest src/tests/svg-classifier.test.ts`
Expected: FAIL (Module not found)

- [ ] **Step 3: Implement the classifier logic**

```typescript
export type SvgType = 'SIMPLE' | 'COMPLEX' | 'HYBRID';

export interface SvgClassification {
  type: SvgType;
  stats: {
    nodes: number;
    segments: number;
    filters: number;
  };
}

export function classifySvg(svgString: string): SvgClassification {
  if (svgString.includes('<image')) {
    return { type: 'HYBRID', stats: { nodes: 0, segments: 0, filters: 0 } };
  }

  const nodes = (svgString.match(/<[^\/!][^>]*>/g) || []).length;
  const segments = (svgString.match(/[a-df-z]/gi) || []).length;
  const filters = (svgString.match(/<filter|<mask|<clipPath/g) || []).length;

  let type: SvgType = 'SIMPLE';
  if (nodes > 1500 || segments > 5000 || filters > 5) {
    type = 'COMPLEX';
  }

  return { type, stats: { nodes, segments, filters } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest src/tests/svg-classifier.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/optimizer/svg-classifier.ts src/tests/svg-classifier.test.ts
git commit -m "feat: add battle-tested SVG classifier"
```

---

### Task 2: Integrate Classifier into `@processSvg`

**Files:**
- Modify: `src/workers/svg-pipeline.ts`

- [ ] **Step 1: Import the classifier and refactor `processSvg`**

Refactor the start of `processSvg` in `src/workers/svg-pipeline.ts`:
```typescript
import { classifySvg } from '@/lib/optimizer/svg-classifier';

// ... inside processSvg
const classification = classifySvg(text);
Logger.debug('SVG Classification', classification);

// Determine if we should wrap as raster based on complexity
const shouldWrap = classification.type === 'COMPLEX' || classification.type === 'HYBRID';
```

- [ ] **Step 2: Implement adaptive output path in `processSvg`**

```typescript
// Replace the wrapper logic in processSvg with an adaptive check
if (shouldWrap) {
  return rasterizeAndWrapAsSvg(text, width, height, options);
} else {
  return optimizeVectorOnly(text, options);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/workers/svg-pipeline.ts
git commit -m "feat: implement adaptive SVG output based on complexity"
```

---

### Task 3: Final End-to-End Validation

- [ ] **Step 1: Run full SVG pipeline tests**
- [ ] **Step 2: Verify specific edge cases in `src/tests/svg-pipeline.test.ts`**
- [ ] **Step 3: Final Commit**
