---
name: drizzle-kit push fails non-interactively when DB has out-of-schema tables
description: `drizzle-kit push` hangs/errors requiring a TTY prompt when the database has tables not declared in the Drizzle schema (e.g. a connect-pg-simple sessions table); create new tables via raw SQL instead.
---

`drizzle-kit push` (and `push --force`) throws `Interactive prompts require a
TTY terminal` when it detects a table in the live database that isn't in the
Drizzle schema — it tries to ask "did you rename X to Y?" and there's no way
to answer non-interactively in this environment, even piping input or adding
`--force`.

**Why:** this project's `sessions` table (created manually for
`connect-pg-simple`, see the connect-pg-simple memory note) is intentionally
absent from the Drizzle schema. Any time new tables are added to the schema
and `push` is run, drizzle-kit's ambiguity resolver treats the untracked
`sessions` table as a rename candidate and blocks on a prompt that can never
be answered in a non-interactive shell.

**How to apply:** when adding brand-new tables to a schema that coexists with
manually-managed out-of-schema tables (sessions, etc.), skip `drizzle-kit
push` for that change — create the new table(s) directly via a raw
`CREATE TABLE IF NOT EXISTS` (matching the Drizzle column defs exactly:
snake_case names, types, defaults) through the database execute-SQL tool
instead. Reserve `drizzle-kit push` for schema changes that don't coexist with
untracked tables.

The same TTY-prompt error can also fire from drizzle-kit's *enum* resolver
(not just tables) when the shared dev Postgres instance already has
unrelated `pg_type` enum values from other artifacts/products in the same
workspace — it's an ambiguity-resolution prompt, not a CI-specific bug. It
did not reproduce against a genuinely fresh, isolated database (verified by
pushing into a brand-new empty database on the same instance), so a service's
own CI job with its own throwaway Postgres container is unaffected — only the
shared workspace dev DB needs the raw-SQL workaround.
