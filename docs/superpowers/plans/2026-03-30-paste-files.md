# Paste Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paste (Ctrl/Cmd+V) support to TinyIMG for quick image upload without drag-drop

**Architecture:** Add global paste event listener in App.tsx that reuses existing `handleFilesAdded` callback. No queue changes needed - already accepts `File[]`.

**Tech Stack:** React hooks (useEffect), Browser Clipboard API

---

### Task 1: Add paste event listener to App.tsx

**Files:**
- Modify: `src/App.tsx:121-130`

- [ ] **Step 1: Add paste event listener after keyboard shortcuts**

Insert after line 124 (after `useKeyboardShortcuts` call):

```typescript
  // Paste support - allows pasting images from clipboard anywhere on page
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files;
      if (!items || items.length === 0) return;

      const files = Array.from(items).filter(file => 
        file.type.startsWith('image/') || 
        file.type === 'image/svg+xml'
      );

      if (files.length > 0) {
        e.preventDefault();
        handleFilesAdded(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFilesAdded]);
```

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add paste support for images"
```

---

### Task 2: Test paste functionality

**Files:**
- Manual test: Open app in browser

- [ ] **Step 1: Test screenshot paste**
- Take a screenshot (Cmd+Shift+4 on Mac)
- Focus TinyIMG app window
- Press Cmd+V
- Expected: Image appears in queue

- [ ] **Step 2: Test copied file paste**
- Copy an image file in Finder
- Focus TinyIMG app window
- Press Cmd+V
- Expected: Image appears in queue

- [ ] **Step 3: Test non-image paste**
- Copy some text
- Press Cmd+V in app
- Expected: No action (text not added to queue)

---

### Task 3: Update Dropzone UI hint (optional)

**Files:**
- Modify: `src/components/Dropzone.tsx:77-84`

- [ ] **Step 1: Add paste hint to dropzone text**

Change line 77-78 from:
```typescript
{isPending ? 'Reading files...' : 'Drop your assets here'}
```

To:
```typescript
{isPending ? 'Reading files...' : 'Drop your assets here or paste (Ctrl+V)'}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Dropzone.tsx
git commit -m "feat: add paste hint to dropzone UI"
```

---

## Summary

| Task | Description | Lines Changed |
|------|-------------|---------------|
| 1 | Add paste event listener | +18 lines App.tsx |
| 2 | Manual testing | N/A |
| 3 | Update UI hint (optional) | +9 chars Dropzone.tsx |

**Total: ~18 lines of code, no new dependencies**