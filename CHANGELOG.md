# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Queue domain modularization support files:
  - `src/lib/queue/queue-item.ts`
  - `src/lib/queue/queue-intake.ts`
  - `src/lib/queue/queue-results.ts`
- Implementation mapping doc: `docs/IMPLEMENTATION-MAP.md`
- Vitest setup and config (`vitest.config.ts`) with queue-result coverage.
- GitHub Actions CI workflow at `.github/workflows/ci.yml`.
- shadcn-style UI primitives:
  - `src/components/ui/button.tsx`
  - `src/components/ui/card.tsx`
  - `src/components/ui/table.tsx`
  - `src/components/ui/checkbox.tsx`
  - `src/components/ui/select.tsx`
  - `src/components/ui/badge.tsx`
- `CONTRIBUTING.md` and Cloudflare deployment runbook.

### Changed

- `QueueProcessor` now delegates intake/result lifecycle logic to queue domain modules while keeping the same public API.
- Directory-drop intake now applies magic-byte validation parity with direct file intake.
- Unit tests migrated from Bun test runner to Vitest.
- Added `typecheck` and `test` scripts; `test:full` now includes unit tests.
- Playwright smoke selectors updated for current UI.
- E2E scripts split into smoke (`test:e2e`) and benchmark (`test:e2e:benchmark`).
- `ConfigPanel`, `ResultsTable`, and `Dropzone` aligned with shared UI primitives.
- `App` reset action now restores default queue options.

