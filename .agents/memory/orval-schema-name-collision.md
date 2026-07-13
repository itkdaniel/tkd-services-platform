---
name: Orval component schema name collides with auto-generated operation name
description: Naming an OpenAPI request/response component schema exactly like orval's auto-derived operation type name causes ambiguous duplicate exports.
---

When adding a path in `lib/api-spec/openapi.yaml`, orval names each operation's
request/response zod const from the **operationId**, not from the `$ref`'d
component schema name (e.g. operationId `createResumeVersion` + a request body
→ const `CreateResumeVersionBody` in `generated/api.ts`, regardless of what the
component schema itself is called).

If you name the component schema in `components.schemas` **exactly** the same
as that auto-derived name (e.g. also calling it `CreateResumeVersionBody`),
orval additionally emits a standalone type file for the component under
`generated/types/`. Both get re-exported via `export * from "./generated/api"`
and `export * from "./generated/types"` in the package index, and because the
names are identical, `tsc` raises `TS2308: Module has already exported a
member` — but only once something actually imports that name (unused
ambiguous exports are silently tolerated).

**Why:** this is easy to miss because the ambiguity error only surfaces when
you `import` the colliding name in application code, which can happen well
after the schema/codegen edit, making the root cause non-obvious.

**How to apply:** give request/response component schemas names that differ
from `<OperationId><Body|Response|Params>` (e.g. `ResumeVersionUploadInput`
instead of `CreateResumeVersionBody`) whenever the operationId would already
produce that exact name. Keep using the orval-generated `<OperationId>Body`
style names in server/client code — only the component name needs to change.
