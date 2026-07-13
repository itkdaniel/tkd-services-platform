---
name: Object storage upload confirm step must verify ownership
description: A "confirm upload" endpoint that trusts a client-supplied objectPath lets any signed-in user hijack or destroy someone else's object.
---

The standard object-storage skill pattern is: client asks the server for a
presigned upload URL, PUTs the file directly to GCS, then calls a "confirm"
endpoint (e.g. `POST /resume/versions`) with the resulting `objectPath` so the
server can record metadata and set the object's ACL.

If that confirm endpoint just trusts the client-supplied `objectPath` and
immediately writes an ACL / DB row for it, any signed-in user can submit an
**existing** object path (e.g. one they saw in a "list versions" response
belonging to someone else) and force a re-ACL or take ownership of it — and
later deleting their own row can cascade into deleting the underlying shared
object.

**Why:** the presigned-URL step only proves you can write bytes to GCS; it
says nothing about who is allowed to claim that path in your application's
database. Treating "I have a valid objectPath string" as proof of ownership
is the actual vulnerability.

**How to apply:** when issuing the presigned upload URL, persist a
server-side intent row (`objectPath` unique, `uploaderId`, `createdAt`, short
TTL). In the confirm endpoint, require a matching, unexpired intent owned by
`req.currentUser`, and delete (consume) it atomically with the insert so the
path can never be claimed twice. Reject if a domain row already references
that objectPath. This generalizes to any "presigned upload + confirm" flow,
not just résumé versions.
