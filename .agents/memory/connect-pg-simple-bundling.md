---
name: connect-pg-simple bundling gotcha
description: createTableIfMissing fails under esbuild-bundled Express servers; how to work around it.
---

`connect-pg-simple`'s `createTableIfMissing: true` option reads a `table.sql`
file from its own package directory at runtime. When the server is bundled
with esbuild (single-file output), that file isn't included in the bundle,
so the option throws/fails silently at startup.

**Why:** discovered while wiring session-based auth into an esbuild-bundled
Express API — sessions silently failed to persist until this was tracked
down.

**How to apply:** set `createTableIfMissing: false` and create the
`sessions` table manually once (standard connect-pg-simple schema: `sid`
PK, `sess` json, `expire` timestamp) via a raw SQL migration or one-off
`psql` command. Do this any time a Node backend that uses
`connect-pg-simple` is bundled with esbuild, webpack, or similar.
