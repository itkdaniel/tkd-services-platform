---
name: Global singleton flags (e.g. isCurrent) aren't test-order-independent
description: A table-wide "only one row is current" flag can be left in a stale state by other tests sharing the same DB table, causing order-dependent failures.
---

When a table uses a global/table-wide singleton flag (e.g. `isCurrent: true` meaning
"only one row across the whole table should have this set"), tests that assert on
that flag are implicitly coupled to every other test that touches the same table —
not just tests within the same file. If tests share one dev Postgres instance and
insert rows into that table without resetting the flag, a test can pass or fail
based on run order alone.

**Why:** this bit us with a "current résumé version" flag — a passing test assumed
it was the only row ever marked current, which broke once other tests also created
rows without cleaning up the flag.

**How to apply:** when writing tests against tables with any singleton/global-state
column, either (a) explicitly re-fetch and assert on the specific row you created
(by id), never assume "the current one" is yours, or (b) reset/clean up the flag
state in that test's teardown so later tests aren't affected.
