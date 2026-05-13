# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Hybrid storage layer (OPFS / IndexedDB / in-memory) for queue payloads and outputs (`src/storage/`, `src/lib/storage/`).
- Raster encode pipeline under `src/lib/codecs/raster/` with shared zip.js configuration (`src/lib/zip-js-config.ts`).
- Worker pool v2 with dedicated thumbnail worker and optimize task core; CPU / offscreen resize (no WebGPU resize path).
- Virtualized results queue (`react-virtuoso`), sticky header, and split result cells under `src/components/results/`.
- Capability probes (`src/capabilities/`) and queue stats helpers (`src/state/`).
- Toast notifications (`src/notifications/`), thumbnail cache/generator (`src/thumbnails/`).
- Knip unused-code check, bundle perf budget script (`scripts/check-perf-budgets.mjs`, `scripts/perf-budgets.json`).
- Tests: raster codec parity, MIME/output format, zip.js assets, offscreen resize integration.

### Changed

- Image store integrates storage adapters, thumbnails, and updated queue intake/validation.
- Package manager lockfile: npm (`package-lock.json`); removed Bun lockfile.
- CI: npm cache, Knip step, existing lint/typecheck/test/build/e2e/quality gates.

### Removed

- WebGPU resize pipeline, GPU worker, and related benchmarks/tests.
- Legacy per-codec modules under `src/lib/codecs/*.codec.ts` in favor of the raster pipeline.
