# Cloudflare Deployment Runbook

This runbook covers production deployment to Cloudflare Pages and rollback.

## 1) Build artifacts

```bash
npm install
npm run build
```

Artifacts are generated in `dist/`.

## 2) Environment

No app-specific build secrets are required for the static UI. Optimization runs entirely in the browser.

## 3) Cloudflare Pages setup

Recommended settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20

## 4) Release checks before promote

Run locally (or in CI) before promoting production:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:quality
```

## 5) Rollback procedure

1. Open Cloudflare Pages project.
2. Go to **Deployments**.
3. Select last known good deployment.
4. Click **Rollback to this deployment**.
5. Re-run smoke checks:
   - app loads
   - upload + optimization
   - download works

## 6) Post-deploy verification

- Open production URL
- Optimize one PNG and one SVG
- Verify output download and size chip rendering
- Confirm no critical console/runtime errors

