---
name: Orval-generated ApiError shape
description: Where the human-readable error message actually lives on a thrown ApiError from generated API hooks.
---

Generated TanStack Query hooks (via Orval + a custom fetch wrapper) throw an
`ApiError` instance on non-OK responses, not a plain object shaped like the
API's JSON error body. The parsed server error body lives on `.data`; a
pre-formatted, always-present human-readable string lives on `.message`
(built from the response status plus whatever `title`/`detail`/`message`/
`error` field the server body had, if any).

**Why:** a design subagent guessed the shape as `err.error` (matching the
Express route's own `{ error: "..." }` JSON convention) across every
`onError` handler in a generated React app; this compiles fine in JS but
fails TypeScript typecheck since `ApiError` has no `.error` property.

**How to apply:** in `onError` handlers for generated mutation/query hooks,
use `err.message` for a ready-to-display string, or `err.data` if you need
the raw parsed server error body. Don't assume the error shape matches the
backend's own route-level JSON convention.
