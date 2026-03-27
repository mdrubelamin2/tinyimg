# Contributing

Thanks for contributing to `TinyIMG`.

## Requirements

- Node 20+
- npm 10+
- Chromium dependencies for Playwright (handled in CI)

## Setup

```bash
npm install
npm run dev
```

## Development standards

- Keep logic modular and explicit (DRY/KISS/SOLID).
- Avoid magic values; prefer named constants in `src/constants.ts`.
- Prefer focused files/modules over large monoliths.
- Keep public queue API stable unless a breaking change is intentional and documented.

## Quality gates (must pass before PR)

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:quality
```

## Testing policy

- Unit tests: `src/tests/*.test.ts` (Vitest)
- E2E smoke: `src/tests/e2e/basic.spec.ts`
- Benchmark E2E (optional for large changes): `npm run test:e2e:benchmark`
- Quality gates compare optimized outputs against baselines in `test-images/`.

## PR checklist

- [ ] Scope is focused and reviewable.
- [ ] New behavior includes tests.
- [ ] Docs updated (`README`, `ARCHITECTURE`, runbooks) when behavior changes.
- [ ] No destructive git operations.

