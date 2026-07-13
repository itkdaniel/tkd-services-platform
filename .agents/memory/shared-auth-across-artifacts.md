---
name: Shared users/auth table across multiple web artifacts
description: Multiple product artifacts in this workspace intentionally share one api-server and one `users` table, so "first user = admin" is global, not per-product.
---

This workspace runs multiple distinct web artifacts (products) against the
same shared `api-server` and the same Postgres database/`users` table, rather
than each artifact getting its own auth stack. This was a deliberate choice
(not requested explicitly) based on the `artifacts` skill's shared-backend
guidance and the fact that a working session-based auth system
(bcrypt + `express-session` + `connect-pg-simple`, `admin`/`user`/`guest`
roles, first registered user becomes admin) already existed and was reused
as-is for a new, unrelated product (TKD Services) added alongside an
existing one (Feature Graph).

**Why:** avoids duplicating auth/session infrastructure per product, but it
means "first user becomes admin" is a workspace-wide event, not scoped to any
one product — whoever registered first *anywhere* in this workspace is the
admin everywhere. This surprised manual testing: registering a fresh test
user for a brand-new product landed as role `"user"`, not `"admin"`, because
an earlier product had already produced user #1.

**How to apply:** when adding a new product/artifact that needs auth in this
workspace, check the `users` table for existing rows before assuming
"register the first user" will make *your* test account the admin. If a
product genuinely needs isolated auth/tenancy (not just a shared backend),
that's a deliberate architectural decision to flag to the user, not a default.
