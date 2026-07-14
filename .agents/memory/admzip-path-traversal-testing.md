---
name: Testing zip path-traversal guards with AdmZip
description: AdmZip's addFile() silently strips "../" from entry names, so it can't be used to construct a malicious traversal test fixture.
---

`AdmZip#addFile(entryName, ...)` normalizes the `entryName` path before storing it,
so any `../` segments are silently removed. A test that tries to build a "hand-crafted
malicious zip" by calling `addFile("../../etc/passwd", ...)` never actually produces
a traversal entry — the app's traversal guard is never exercised, and the test can
pass for the wrong reason (or fail confusingly).

**How to apply:** build the zip normally with `addFile`, then reach into
`zip.getEntries()` and mutate `entry.entryName` directly (post-construction) before
calling `zip.toBuffer()`. That bypasses AdmZip's own normalization and produces a
genuinely unsafe entry name for the app's guard to reject.
