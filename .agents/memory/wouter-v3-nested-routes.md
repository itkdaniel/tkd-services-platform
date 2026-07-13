---
name: wouter v3 nested Switch routing gotcha
description: Wrapping an app's routes in an outer Route+Switch (e.g. for a shared Layout) with wouter v3 requires the exact nest pattern, or every path silently renders the root route.
---

When wrapping a whole app's routes in an outer `<Route nest>` (e.g. to share a
Layout/Navbar/Footer across all pages while keeping `/login` and `/register`
outside it), the outer route's `path` matters a lot:

- `<Route path="/*?" nest>` looks like a reasonable "match everything" wildcard
  but is wrong: the wildcard consumes the *entire* current path into the nest
  base, leaving the "rest" path passed to the inner `<Switch>` as just `"/"`.
  Every inner route then resolves against `"/"`, so only the route mapped to
  `"/"` (e.g. Home) ever renders — every other path silently shows the same
  page instead of erroring, which makes the bug easy to miss visually.
- `<Route path="/" nest>` is correct for this pattern: it matches the leading
  `"/"` (true for every path) and correctly passes the full remaining path
  down to the inner `Switch`.

**Why:** discovered building a multi-page site where `/blog`, `/about`,
`/contact` etc. all rendered the Home page after introducing an outer nest
wrapper — no console error, so it looked like a data problem before the
routing bug was found.

**How to apply:** whenever nesting a `<Switch>` inside an outer `<Route nest>`
for a shared layout in wouter v3, use `path="/"` (not a wildcard) on the outer
Route. Verify by screenshotting/loading an arbitrary nonsense path — if it
renders Home instead of your 404 page, the nest pattern is wrong.
