---
name: GitHub Git Data API tree creation is unreliable via connectors.proxy
description: POST /git/trees (with many entries, or with base_tree chaining) intermittently 404s through the GitHub connector proxy; use the Contents API PUT loop instead for bulk-publishing many files to a fresh repo.
---

# GitHub Git Data API tree creation is unreliable through the connector proxy

When publishing a large file set to a GitHub repo by hand (blobs → tree → commit → ref update) via `connectors.proxy("github", ...)`, blob creation (`POST /git/blobs`) is reliable even for large individual files, but `POST /git/trees` is not:
- A single tree-create call with ~20+ entries (or as little as ~2.3KB of JSON body) can return a bare `404 Not Found` instead of `201`.
- Chaining smaller batches via `base_tree` doesn't reliably fix it either — even 2-3 small chained calls in a row can 404 partway through, with retries/backoff not helping.

**Why:** Root cause wasn't confirmed (possibly a proxy-side request-size or rate quirk specific to this endpoint) — but the failure is consistent and not fixable by retrying or shrinking batches further.

**How to apply:** Don't rely on manual Git Data API tree construction to bulk-publish many files to a repo through this proxy. Instead, loop the Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`) one file at a time — slower (one commit per file) but reliable. Reserve manual git object work for single small ref/commit operations. Also: prefer the `gitPush` tool first — it usually works; only fall back to manual API pushes if `gitPush` fails for a *diagnosed* reason (e.g. see workflow-scope limitation), not just because it errored once.
