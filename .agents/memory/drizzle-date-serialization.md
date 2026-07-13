---
name: Drizzle Date objects vs Zod response schemas
description: Timestamp columns come back as Date objects from Drizzle but generated Zod schemas expect ISO strings.
---

Drizzle ORM returns native `Date` objects for `timestamp` columns. If API
response validation is generated from an OpenAPI spec (e.g. via Orval) with
`date-time` string fields, the generated Zod schema expects an ISO string,
not a `Date` instance — `SomeResponse.parse(rowFromDb)` will fail or
silently coerce incorrectly depending on the Zod config.

**Why:** caught via curl smoke-testing (not by typecheck) when wiring
Drizzle + Zod-validated Express routes together — the mismatch only shows
up at runtime.

**How to apply:** before calling `*Response.parse(...)` on any DB row (or
array of rows) that includes timestamp columns, round-trip it through
`JSON.parse(JSON.stringify(value))` (or an equivalent explicit
Date→ISO-string mapper) first. Apply this at every route that returns
DB-sourced timestamps, not just one.
