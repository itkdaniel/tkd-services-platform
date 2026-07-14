---
name: Freeze "now" for relative-offset test fixtures
description: Test fixtures built as "N hours/days from now" must run against a frozen clock, or slot/ordering assertions flip between pass/fail depending on real wall-clock time.
---

Any test fixture helper that derives a value from `Date.now()`/`new Date()`
plus a relative offset (e.g. "the next open business slot at least N hours
from now") is only as deterministic as real wall-clock time lets it be. Two
distinct failure modes showed up in one booking-service test suite:

1. **Offset collapse**: when the offset window is much narrower than a day
   (e.g. business hours 9am-5pm), several different "hours from now" offsets
   can round up to the *same* slot if "now" happens to fall late in the day —
   causing spurious double-booking/duplicate-notification failures that only
   reproduce at certain times of day.
2. **Boundary flip**: a test that nudges a valid slot forward by a fixed
   number of hours to assert it's now *invalid* can land back inside a valid
   window depending on what hour the base slot resolved to relative to real
   "now".

**Why:** these only fail intermittently in CI/dev depending on the hour the
suite happens to run, which erodes trust in the suite (flip between green
and red with no code change).

**How to apply:** add a test-only global `beforeAll`/`afterAll` (e.g. a
`vitest` setup file) that calls `vi.useFakeTimers({ now: <fixed instant>,
toFake: ["Date"] })` — fake only `Date`, not timers, so supertest/express/db
drivers keep running on real timers. Pick the fixed instant deliberately:
mid-week, mid-business-day, with enough headroom for the largest relative
offset used anywhere in the suite to land on a distinct slot without
colliding with smaller offsets. Any fixture that inserts multiple rows with a
unique-constrained relative-offset column (e.g. multiple test cases each
calling a `new Date(Date.now() + fixedOffset)` helper) also needs a
per-call-incrementing offset, since freezing time removes the accidental
real-clock drift that used to keep those calls from colliding.
