# Contributing to strug-platform-ts

## Branch workflow

Branch off `main`. One branch per PR.
See `~/.claude/CLAUDE.md` for full global branch rules.

## Pre-push checks

The pre-push hook runs automatically on push:
- `npm run lint`
- `npm run typecheck`
- `npm test`

Fix all errors before pushing.

## Adding a new package

1. `mkdir -p packages/<name>/src`
2. Create `packages/<name>/package.json` (see calendar-primitives as reference)
3. Create `packages/<name>/tsconfig.json` (extends `../../tsconfig.base.json`)
4. Add `{ "path": "packages/<name>" }` to root `tsconfig.json` references
5. Update `README.md` packages table
6. Run `node scripts/sync-ci.js --project strug-platform-ts` from strug-standards to ensure CI covers new package

## Breaking changes

- `v0.x`: public API may change freely between minor versions (pre-stable)
- After `v1.0`: semver strictly enforced; breaking changes require a major bump + migration guide in CHANGELOG

## Publishing

```bash
cd packages/<name>
npm version patch    # or minor / major
npm publish
```

Registry: public npm under `@strugcity` scope.
