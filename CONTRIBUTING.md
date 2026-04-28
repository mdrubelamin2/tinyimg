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

## Git Workflow

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/modifications

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear, semantic commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `refactor`: Code refactoring
- `test`: Test changes
- `style`: Formatting/style changes
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Revert previous commits

**Example:**

```
feat(optimizer): add AVIF compression support

Added AVIF image format support using @jsquash/avif library.
Compression ratio improved by 15% for photographic images.

Closes #123
```

### Pre-commit Checks

Before committing, ensure:

- All linting passes (`npm run lint`)
- Type checking passes (`npm run typecheck`)
- Tests pass (`npm run test`)

These checks run automatically via Husky hooks.

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

- Scope is focused and reviewable.
- New behavior includes tests.
- Docs updated (`README`, `ARCHITECTURE`, runbooks) when behavior changes.
- No destructive git operations.
