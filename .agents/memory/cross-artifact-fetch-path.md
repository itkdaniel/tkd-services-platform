---
name: Fetching a different artifact's shared API — don't prefix with your own BASE_URL
description: import.meta.env.BASE_URL is this artifact's own base path; a shared backend owned by a different artifact (e.g. "/api") must be fetched root-relative, not nested under it.
---

In this workspace, each artifact owns a distinct path prefix behind the shared
proxy (e.g. an API server owns `/api` globally, a dashboard artifact owns
`/status-dashboard/`). `import.meta.env.BASE_URL` in a Vite artifact is *that
artifact's own* base path — it must only be used to reference the artifact's own
assets/routes.

If one artifact's frontend needs to call a *different* artifact's shared backend
route (e.g. a dashboard calling a global `/api/...` endpoint owned by a separate
API service), prefixing the fetch with `${import.meta.env.BASE_URL}` is wrong: it
produces `/status-dashboard/api/...`, which doesn't match the API server's
registered prefix. The dev proxy then falls through to the calling artifact's own
Vite dev server, whose SPA catch-all returns `200` with `index.html` — so the bug
manifests as a fetch that "succeeds" with status 200 but the body is HTML, causing
JSON.parse to fail (or, if unguarded, an infinite loading state instead of a clean
error).

**How to apply:** when fetching a route owned by a *different* artifact/service,
use a plain root-relative path (e.g. `/api/dev/test-status`), never your own
`BASE_URL`. Reserve `BASE_URL`-prefixed fetches for the artifact's own backend
routes nested under its own prefix.
