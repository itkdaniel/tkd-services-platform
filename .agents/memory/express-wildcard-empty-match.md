---
name: Express 5 named wildcard doesn't match empty/bare/trailing-slash path
description: A route like `/foo/*path` 404s at the Express layer (not your handler) for `/foo`, `/foo/`, and other zero-segment hits; register explicit sibling routes for those cases.
---

`router.get("/foo/:id/bar/*path", handler)` only matches when at least one
path segment follows `bar/`. Requests to `/foo/1/bar`, `/foo/1/bar/` never
reach `handler` at all — Express's own default 404 page is returned, not
your route's fallback/not-found logic — because path-to-regexp's named
wildcard requires ≥1 segment, it does not default to `""`.

**Why:** discovered building a static-file-serving route for a "default to
index.html when no sub-path is requested" pattern (serving an extracted
sub-app archive) — the bare/trailing-slash entrypoint request silently
bypassed the handler's own entrypoint-fallback code.

**How to apply:** whenever a wildcard route is meant to have a meaningful
zero-segment case (e.g. "serve the entrypoint file by default"), register it
explicitly alongside the wildcard: `router.get(["/foo/:id/bar", "/foo/:id/bar/", "/foo/:id/bar/*path"], handler)`.
Don't assume the wildcard covers the empty case — test the bare path.
