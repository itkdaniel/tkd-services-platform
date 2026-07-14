---
name: Stale lib/*/dist declarations break tsc despite passing runtime/tests
description: tsc --noEmit on an artifact can report "has no exported member" for things that clearly exist in a lib's src, and tests still pass — the cause is a stale dist/ build for that lib, not bad imports.
---

## The problem

Composite `lib/*` packages (e.g. `@workspace/db`, `@workspace/api-zod`) declare
`"exports": { ".": "./src/index.ts" }` in `package.json`, so **runtime** resolution
(Vite, vitest/esbuild, tsx) always reads straight from `src/` and works fine even
if `dist/` is stale or missing exports.

But `tsc --build`/`tsc --noEmit` project-reference resolution for *consumers* of
that lib reads the lib's compiled `dist/*.d.ts`, not `src/`. If new
tables/schemas/types were added to a lib's `src/schema/index.ts` or
`src/generated/*.ts` but `dist/` was never rebuilt (e.g. schema tables added by
hand via raw SQL + source edits, without running the lib's build), `tsc` on any
consumer artifact reports `has no exported member 'X'` for symbols that visibly
exist in the lib's source and that vitest-based tests use successfully.

**Why:** stale build artifacts silently diverge from source; nothing fails until a
real `tsc` type-check (not test runs, which bypass `tsc` via esbuild/vite-node)
is attempted against the consumer.

**How to apply:** if `tsc --noEmit` on an artifact reports missing exports from a
`lib/*` package that clearly has them in `src/`, don't chase the consumer's
imports — check `lib/<name>/dist/**/*.d.ts` for the missing symbols first. Fix by
rebuilding that lib: `cd lib/<name> && pnpm exec tsc --build --force` (or run the
workspace's `pnpm run typecheck:libs` / lib build script). Re-run the consumer's
`tsc --noEmit` afterward to confirm.
