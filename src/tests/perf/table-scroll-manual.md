# Results Table Virtualization - Manual Performance Test

## Test Case: Scroll with 100+ Items

### Setup

1. Prepare 100+ test images (can use duplicates of the same small image)
2. Start the dev server: `npm run dev`
3. Open browser DevTools → Performance tab

### Test Steps

#### Test 1: Initial Render

1. Drop 100+ images onto the dropzone
2. **Expected:** Table renders immediately with first ~15 rows visible
3. **Expected:** No blank rows visible in viewport
4. **Check:** DevTools Performance shows < 100ms render time

#### Test 2: Rapid Scroll Down

1. Click and drag scrollbar rapidly to bottom
2. **Expected:** Rows render as they enter viewport
3. **Expected:** No blank/white rows visible during scroll
4. **Expected:** Scroll feels smooth at 60fps

#### Test 3: Rapid Scroll Up

1. From bottom, rapidly scroll back to top
2. **Expected:** Same as Test 2 - no blank rows
3. **Expected:** Sticky header remains visible at top

#### Test 4: Processing State Updates

1. With 100+ items loaded, watch as they process
2. **Expected:** Individual rows update without causing full table re-render
3. **Expected:** No flickering or blank rows during status updates

### Performance Metrics

Open Chrome DevTools → Performance → Record, then scroll:

| Metric                     | Target           | Actual |
| -------------------------- | ---------------- | ------ |
| FPS during scroll          | 55-60 fps        | \_\_\_ |
| Max render time            | < 16ms (1 frame) | \_\_\_ |
| Visible blank rows         | 0                | \_\_\_ |
| Sticky header stays pinned | Yes              | \_\_\_ |

### Virtualization Verification

In browser console, run:

```javascript
// Count how many rows are actually rendered in DOM
const rows = document.querySelectorAll('tbody tr')
console.log(`Rendered rows: ${rows.length}`)
console.log(`Total items: ${itemIds.length}`)
console.log(`Virtualization working: ${rows.length < itemIds.length}`)
```

**Expected:** With 100 items, only ~15-20 rows should be in DOM at any time.

### Known Issues

If you see blank rows:

1. Check browser console for errors
2. Verify `itemIds` array is populated correctly
3. Check if `estimateSize: 80` matches actual row height (may need adjustment)
