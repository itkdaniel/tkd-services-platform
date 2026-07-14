---
name: api-server dev DB schema drift
description: Drizzle schema tables (object_upload_intents, resume_versions, projects) can be entirely absent from the shared dev DB even when the code and prior tests referencing them look complete.
---

While working on the résumé-upload orphan cleanup, `pnpm vitest run` for
`artifacts/api-server` failed with `relation "X" does not exist` for
`object_upload_intents`, `resume_versions`, and `projects` in turn — on code
that was already merged and looked fully implemented (routes, tests, drizzle
schema all present).

**Why:** `drizzle-kit push` can't be run non-interactively against this
project's shared dev DB once out-of-schema tables exist (see the
`drizzle-push-interactive-prompt` note), so tables added to the Drizzle schema
after that point may never actually get created in the live dev database —
the schema file and the DB silently diverge.

**How to apply:** if API-server tests fail with `relation "X" does not exist`
or every write to a table 500s, don't assume it's a bug in the current
change — check `information_schema.columns` for that table first
(`SELECT column_name, data_type FROM information_schema.columns WHERE
table_name = 'X'`). If the table (or a pgEnum type it depends on) is missing,
create it via raw `CREATE TABLE IF NOT EXISTS` / `CREATE TYPE` matching the
Drizzle schema exactly (snake_case columns, `references()` FKs, defaults)
instead of running `drizzle-kit push`.
