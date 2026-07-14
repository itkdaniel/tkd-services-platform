# TKD Services

A personal portfolio / independent-consulting website: hero + about pages,
a project portfolio, a blog, a contact form, a résumé manager (upload,
version, publish), and call-booking backed by a standalone microservice.

See `README.md` at the repo root for the full architecture, environment
variables, self-hosting (Docker Compose) instructions, and release process.

## Run & Operate

- `pnpm --filter @workspace/tkd-services run dev` — public site (frontend)
- `pnpm --filter @workspace/api-server run dev` — main app backend (port 8080)
- `pnpm --filter @workspace/booking-service run dev` — booking microservice (port 8000; runs via the `Booking Service` workflow)
- `pnpm --filter @workspace/status-dashboard run dev` — internal test status dashboard (not part of the public site)
- `pnpm --filter @workspace/feature-graph run dev` — internal feature/graph explorer (not part of the public site)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-server run test:coverage` / `pnpm --filter @workspace/booking-service run test:coverage` — test suites (also run in CI)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `BOOKING_SERVICE_URL`, `BOOKING_SERVICE_API_KEY`, `BOOKING_DATABASE_URL`, object-storage vars (see `.env.example`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, `express-session` + `connect-pg-simple` for sessions, `bcryptjs` for password hashing
- DB: PostgreSQL + Drizzle ORM (main app and booking microservice each have their own database)
- Web: React + Vite, Tailwind, Radix UI primitives
- Booking microservice: Express, `node-cron` for reminders, `nodemailer`/Gmail connector for email
- Build: esbuild (API server, booking service), Vite (frontends)

## Where things live

- `artifacts/tkd-services` — public site.
- `artifacts/api-server` — Express API (auth, blog, projects, résumé, contact, storage, booking proxy).
- `artifacts/booking-service` — standalone booking microservice; also published as its own repo (`itkdaniel/tkd-booking-service`).
- `artifacts/status-dashboard`, `artifacts/feature-graph`, `artifacts/mockup-sandbox` — internal dev tooling, not part of the shipped product.
- `lib/db` — Drizzle schema for the main app.
- `deploy/`, root `docker-compose.yml`, `.github/workflows/` — self-hosting reference tooling + CI/CD (see README's "Running via Docker Compose" and "Cutting a release" sections).

## Multi-repo publishing

This monorepo is published at `itkdaniel/tkd-services-platform`. The booking
microservice is additionally mirrored as a standalone repo,
`itkdaniel/tkd-booking-service`, so it can be reused outside this project.
When `artifacts/booking-service` changes, mirror the change into that repo
too (see README's "Cutting a release" section).

## User preferences

_None recorded yet._

## Gotchas

- `connect-pg-simple`'s `createTableIfMissing: true` fails under the esbuild-bundled server (it tries to read a `table.sql` file that isn't bundled). Keep it `false`.
- Drizzle returns `Date` objects for timestamp columns but generated Zod response schemas expect ISO strings — serialize before validating.
- Canvas 2D contexts cannot resolve CSS variables in `ctx.font`/`ctx.fillStyle` — always pass literal values.
- Object storage (résumé PDFs, portfolio images) relies on Replit's built-in Object Storage sidecar; self-hosting that feature requires pointing at a real GCS bucket with your own credentials.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
