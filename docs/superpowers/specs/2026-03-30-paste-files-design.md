# Paste Files Feature Design

## Overview
Add paste (Ctrl/Cmd+V) support to TinyIMG, allowing users to paste images anywhere on the page.

## User Experience

**Trigger:** User presses Ctrl/Cmd+V anywhere on the page

**Supported paste types:**
- Screenshots from clipboard (image data)
- Image files copied from Finder/Explorer

**Not supported (browser limitation):**
- Folders (must use drag-drop)
- .zip files (must use drag-drop)

**Behavior:**
- Processing: Same flow as drag-drop
- Visual feedback: Dropzone shows "Reading files..." state during processing

## Implementation

### Approach
Add global paste event listener in `App.tsx` that reuses existing `handleFilesAdded` function.

### Changes

**File: `src/App.tsx`**

Add `useEffect` with paste listener after existing keyboard shortcuts:

```typescript
useEffect(() => {
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.files;
    if (!items || items.length === 0) return;
    
    const files = Array.from(items).filter(file => 
      file.type.startsWith('image/') || 
      file.type === 'image/svg+xml'
    );
    
    if (files.length > 0) {
      handleFilesAdded(files);
    }
  };

  window.addEventListener('paste', handlePaste);
  return () => window.removeEventListener('paste', handlePaste);
}, [handleFilesAdded]);
```

### Why This Approach

1. **Reuses existing flow** - `handleFilesAdded` already accepts `File[]`
2. **No queue changes** - `collectItemsFromFiles()` handles File[] input
3. **No new dependencies** - Pure browser API, ~20 lines of code
4. **No toast needed** - Dropzone shows "Reading files..." via existing `isPending` state
5. **97% browser support** - Works on all modern browsers

### Browser Limitations

| Input Type | Paste | Drag-Drop |
|------------|-------|-----------|
| Screenshots | ✅ | ✅ |
| Copied image files | ✅ | ✅ |
| Folders | ❌ | ✅ |
| .zip files | ❌ | ✅ |

This is a browser limitation - Clipboard API only exposes File objects, not folder structures.

## Testing
- Paste screenshot from clipboard (Cmd+Shift+4 → paste)
- Paste copied image file from Finder
- Paste text (should do nothing)
- Verify processing works same as drag-drop