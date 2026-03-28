# Configure `@/` Path Aliases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map `@/` to the `src/` directory in both TypeScript and Vite configuration to simplify imports.

**Architecture:** Update `tsconfig.app.json` for editor/compiler support and `vite.config.ts` for runtime/bundler support using the standard `path.resolve` mapping.

**Tech Stack:** TypeScript, Vite, Node.js (`path` module).

---

### Task 1: Update TypeScript Configuration

**Files:**
- Modify: `tsconfig.app.json`

- [ ] **Step 1: Update `compilerOptions` in `tsconfig.app.json`**

Add `baseUrl` and `paths` to `compilerOptions`.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    ...
  }
}
```

- [ ] **Step 2: Commit changes**

```bash
git add tsconfig.app.json
git commit -m "config: add @/ path alias to tsconfig"
```

### Task 2: Update Vite Configuration

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Update `vite.config.ts` to include `resolve.alias`**

Import `path` and add the `resolve` configuration.

```typescript
import path from 'path';
import { defineConfig } from 'vite';
// ... other imports

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    // ...
  ],
  // ...
});
```

- [ ] **Step 2: Commit changes**

```bash
git add vite.config.ts
git commit -m "config: add @/ path alias to vite"
```

### Task 3: Verification

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: Should not fail due to configuration errors (e.g., "cannot find module '@/'"). Note: Existing type errors in the project are acceptable for this task.
