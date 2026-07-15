---
name: Sub-app storage quota enforcement
description: How the shared total-storage ceiling on extracted sub-app bundles is computed and where the dev DB drift issue can resurface.
---

Total sub-app storage usage is computed by summing GCS object sizes live
(`ObjectStorageService.getTotalSizeUnderPrefix`), not from a stored column —
so it lists every object under the shared `subapps/` prefix on each upload.
This is O(bucket size) per upload; a follow-up (task tracker: "Stop
storage-quota checks from listing every file on each upload") proposes
caching per-project size in the DB instead if this becomes a bottleneck.

**Why:** simplest correct implementation given no existing per-project size
column; avoids a migration for the first cut of the quota feature.

**How to apply:** when replacing this with a DB-tracked size, keep the
"net out this project's own previous prefix before comparing to the quota"
behavior — a re-upload replacing an existing sub-app must not double-count
the bundle being replaced.
