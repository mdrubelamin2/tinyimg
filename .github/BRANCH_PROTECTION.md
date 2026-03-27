# Branch Protection Rules

## Main Branch Settings (configure in GitHub UI)

1. Go to Settings → Branches → Add branch protection rule
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (1 reviewer minimum)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging
   - ✅ Include administrators (optional but recommended)

## Required Status Checks

- `quality` (CI workflow)
- All linting and test jobs must pass

## Commit Requirements

- Conventional commit format (enforced by commitlint)
- Signed commits recommended (not required)
