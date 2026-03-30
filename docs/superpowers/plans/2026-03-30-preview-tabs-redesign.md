# Preview Modal Tabs UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp format tabs in ImagePreview modal with fluid sliding pill, glassmorphism, and rich content per tab.

**Architecture:** Single component update in ImagePreview.tsx - replace static button tabs with sliding pill animation using CSS transforms and absolute positioning.

**Tech Stack:** React, Tailwind CSS, Lucide icons

---

### Task 1: Implement sliding pill tab bar in ImagePreview

**Files:**
- Modify: `src/components/preview/ImagePreview.tsx`

- [ ] **Step 1: Replace the format tabs section (lines 118-151)**

Replace the current tabs div with the new sliding pill implementation:

```tsx
{/* Format Tabs */}
{successResults.length > 1 && (
  <div className="relative flex items-center px-4 py-3 border-b border-border bg-muted/30 backdrop-blur-sm">
    {/* Sliding Pill Background */}
    <div
      className="absolute h-9 bg-primary rounded-xl shadow-lg shadow-primary/25 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        width: `${tabWidth}px`,
        transform: `translateX(${tabTranslateX}px)`,
      }}
    />
    
    {/* Tab Buttons */}
    <div className="relative flex items-center gap-1" ref={tabsRef}>
      {successResults.map((result) => {
        const isActive = result.format === selectedFormat;
        const formatSavings = originalSize > 0 && result.size
          ? ((originalSize - result.size) / originalSize * 100).toFixed(0)
          : null;
        
        return (
          <button
            key={result.format}
            ref={isActive ? activeTabRef : null}
            onClick={() => onFormatChange(result.format)}
            onMouseEnter={() => setHoveredFormat(result.format)}
            onMouseLeave={() => setHoveredFormat(null)}
            className={cn(
              'relative z-10 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200',
              isActive
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:scale-[1.02]'
            )}
          >
            <span className="flex items-center gap-2">
              {result.label ?? result.format}
              {formatSavings && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                  isActive ? 'bg-white/20 text-white' : 'bg-success/15 text-success'
                )}>
                  -{formatSavings}%
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 2: Add required state and refs**

Add these imports at the top:
```tsx
import { useRef, useState, useEffect, useMemo } from 'react';
```

Add these state variables after the existing state declarations (after line 31):
```tsx
const [hoveredFormat, setHoveredFormat] = useState<string | null>(null);
const tabsRef = useRef<HTMLDivElement>(null);
const activeTabRef = useRef<HTMLButtonElement>(null);
const [tabWidth, setTabWidth] = useState(0);
const [tabTranslateX, setTabTranslateX] = useState(4);
```

- [ ] **Step 3: Add effect to calculate pill position**

Add after the formatBytes function (around line 80):
```tsx
useEffect(() => {
  if (!activeTabRef.current || !tabsRef.current) return;
  
  const tabsRect = tabsRef.current.getBoundingClientRect();
  const activeRect = activeTabRef.current.getBoundingClientRect();
  
  const newWidth = activeRect.width;
  const newTranslateX = activeRect.left - tabsRect.left;
  
  setTabWidth(newWidth);
  setTabTranslateX(newTranslateX);
}, [selectedFormat, successResults]);
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: No errors

---

### Task 2: Verify implementation matches spec

**Files:**
- Review: `src/components/preview/ImagePreview.tsx`

- [ ] **Step 1: Check visual requirements**

- [ ] Sliding pill with primary background - DONE (Step 1)
- [ ] Glassmorphism background (bg-muted/30 backdrop-blur-sm) - DONE (Step 1)
- [ ] Rich content per tab (format + size + savings) - Need to add size display
- [ ] Hover scale effect - DONE (hover:scale-[1.02])
- [ ] 300ms cubic-bezier transition - DONE (ease-[cubic-bezier(0.4,0,0.2,1)])
- [ ] Shadow on active pill - DONE (shadow-lg shadow-primary/25)

- [ ] **Step 2: Add file size to tab content**

The spec says: `[ WEBP · 24.5 KB · -38% ]`

Update the tab button to include file size:
```tsx
<span className="flex items-center gap-1.5">
  <span>{result.label ?? result.format}</span>
  <span className="text-[10px] opacity-60">·</span>
  <span className="text-[10px] opacity-80">
    {result.size != null ? formatBytes(result.size) : '—'}
  </span>
  {formatSavings && (
    <span className={cn(
      'ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold',
      isActive ? 'bg-white/20 text-white' : 'bg-success/15 text-success'
    )}>
      -{formatSavings}%
    </span>
  )}
</span>
```

- [ ] **Step 3: Run typecheck and lint again**

Run: `npm run typecheck && npm run lint`
Expected: No errors

---

### Task 3: Final verification

- [ ] **Step 1: Test the component**

The implementation is complete. Test by:
1. Adding multiple images to the app
2. Clicking on the image thumbnail to open preview
3. Verify tabs appear when multiple formats exist
4. Click different tabs and observe sliding animation
5. Check hover effects work

- [ ] **Step 2: Commit**

```bash
git add src/components/preview/ImagePreview.tsx
git commit -m "feat: revamp preview modal tabs with fluid sliding pill animation"
```