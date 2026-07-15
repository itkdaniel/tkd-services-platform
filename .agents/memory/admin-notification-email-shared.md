---
name: ADMIN_NOTIFICATION_EMAIL is a shared, workspace-wide env var
description: The admin notification email address is one shared config value across services, not per-service.
---

`ADMIN_NOTIFICATION_EMAIL` (set as a shared env var, currently
`featureforge.io@gmail.com`) was introduced by `booking-service` for its own
appointment notifications, but represents "the one site admin's email" for
this whole workspace — reuse it directly for any other service that needs to
email the admin (e.g. `api-server`'s résumé-upload notification) instead of
inventing a second, differently-named env var.

**Why:** this project's products intentionally share one admin identity
(see `shared-auth-across-artifacts.md`); duplicating the config would create
two knobs that must be kept in sync by hand.

**How to apply:** before adding a new `*_ADMIN_EMAIL`/`*_NOTIFICATION_EMAIL`
env var, check `viewEnvVars` for `ADMIN_NOTIFICATION_EMAIL` first.
