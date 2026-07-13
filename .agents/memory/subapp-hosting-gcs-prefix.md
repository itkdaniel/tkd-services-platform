---
name: Isolated sub-app hosting via a unique object-storage prefix
description: Pattern for letting admins upload an archive that gets extracted and served as a scoped, isolated mini-app, without per-file ACL machinery.
---

To host an admin-uploaded static bundle (e.g. a portfolio project's demo) as
an isolated sub-app without building a second hosting/proxy layer:

1. Reuse the existing two-step presigned-upload flow to get the raw archive
   into object storage, with the existing `objectUploadIntentsTable`
   ownership check (see `object-storage-confirm-ownership.md`) before trusting
   it.
2. Download and validate the archive server-side (size/file-count caps, reject
   `..`/absolute paths and symlinks, require an HTML entrypoint, flatten a
   single common top-level wrapper directory if present).
3. Extract every entry into a **freshly generated, unique prefix**
   (e.g. `subapps/<uuid>/...`) inside the same private object-storage bucket
   used for everything else — write each file directly (not via the
   presigned-upload path).
4. Serve that prefix through a dedicated, intentionally public, unauthenticated
   raw route (`GET /.../subapp/*path`) that bypasses the normal per-object ACL
   check entirely — the file is public by design once deployed, and isolation
   comes from the resource only ever reading files under its own unique
   prefix, not from ACL checks.
5. Delete the original archive object and any previous prefix's files after a
   successful re-extraction / on removal, to avoid unbounded storage growth.

**Why:** avoids inventing a second static-file server, a local-disk approach
(ephemeral in prod), or per-file ACL bookkeeping for potentially thousands of
extracted files — the unique prefix alone gives isolation, and the public
serving route only needs to know how to map a request path onto that prefix.

**How to apply:** anytime a feature needs "upload a build, get an embeddable
mini-site out of it" — the same shape applies beyond portfolios (e.g. game
jam entries, docs sites, embeddable widgets).
