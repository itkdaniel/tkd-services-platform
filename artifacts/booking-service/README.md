# Booking Service

A standalone, portable appointment-booking microservice: availability, booking, double-booking
prevention, in-app notification/inbox records, and a reminder scheduler with a provider-agnostic
email layer (Gmail by default, any SMTP provider via config).

It is intentionally self-contained — its own `package.json`, own Postgres schema/migrations, own
Dockerfile — so it can be copied into another project and pointed at that project's own database
and secrets with no code changes.

This directory is also published as its own repository,
[`itkdaniel/tkd-booking-service`](https://github.com/itkdaniel/tkd-booking-service), so it can be
used outside the `tkd-services-platform` monorepo. When this directory changes, mirror the change
into that repo too (see the root README's "Cutting a release" section).

## Running standalone

```bash
cp .env.example .env   # fill in real values
pnpm install
pnpm run db:push        # creates the booking_* tables
pnpm run dev
```

## Integrating with a host app

The host app's backend (not its frontend) should call this service over HTTP, sending the shared
secret in `x-internal-api-key`, and handle end-user auth/roles itself before proxying:

- `GET /availability?from=<ISO>&to=<ISO>` — open/closed slots in range
- `POST /appointments` — book a slot (`title`, optional `reason`, `name`, `email`, `start`,
  optional `externalUserId`/`externalUserLabel` for signed-in users)
- `GET /appointments?upcomingOnly=true` — list appointments (gate behind admin auth in the host app)
- `GET /notifications?recipient=admin&unreadOnly=true` — inbox feed (gate behind admin auth)
- `PATCH /notifications/:id/read` — mark an inbox item read

See `artifacts/api-server/src/routes/booking.ts` in this workspace for a reference proxy
implementation, including how it forwards the signed-in user's identity on booking creation and
enforces `requireRole("admin")` on the admin-only endpoints.

## Swapping email providers

Set `EMAIL_PROVIDER=smtp` plus `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM` to use
any SMTP provider (ProtonMail, Tutanota, a company mail server, etc). No code changes needed —
`src/lib/email/index.ts` selects the adapter purely from config.

## Reminder scheduling

A cron job (`REMINDER_CHECK_CRON`, default every 15 minutes) checks for confirmed appointments
entering a "day before" or "3 hours before" window and sends exactly one reminder of each kind per
appointment per recipient, tracked via the `booking_notifications` table so re-runs never
double-send. `POST /admin/run-reminder-sweep` forces an immediate sweep for testing.
