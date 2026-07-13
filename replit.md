# Feature Graph

A feature-engineering knowledge-graph platform: typed data tables, entries,
and weighted/justified relations between them, explorable via a web UI, a
Python CLI, and a REST API. Seeded with an NBA player-props example dataset.

See `README.md` at the repo root for the full architecture, data model, and
roadmap (including what was explicitly deferred/documented-as-reference vs.
actually built).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, path `/api`)
- `pnpm --filter @workspace/feature-graph run dev` — run the web UI
- `pnpm --filter @workspace/api-server run seed` — seed demo data (idempotent; creates `demo`/`demo12345` admin on first run)
- `uv run cli/main.py --help` — Python CLI (talks to the API server over HTTP)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, `express-session` + `connect-pg-simple` for sessions, `bcryptjs` for password hashing
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) → `lib/api-client-react` TanStack Query hooks
- Web: React + Vite, `react-force-graph-2d` for graph rendering, `react-hook-form` + Zod for forms
- Build: esbuild (CJS bundle) for the API server
- CLI: Python 3.11, `click` + `rich` + `requests`, managed with `uv`

## Where things live

- `artifacts/api-server` — Express API. Routes in `src/routes/*`; auth middleware in `src/middlewares/auth.ts`; in-process cache in `src/lib/cache.ts`; seed script in `src/scripts/seed.ts`.
- `artifacts/feature-graph` — web UI (graph explorer at `/`, table directory at `/tables`, table workspace at `/tables/:id`, `/login`, `/register`).
- `lib/db/src/schema` — Drizzle schema: `users`, `featureTables`, `featureFields`, `featureEntries`, `entityRelations`.
- `lib/api-spec/openapi.yaml` — source-of-truth API contract.
- `cli/` — Python CLI (`main.py` entrypoint, `commands/` per resource, `api_client.py`, `logging_utils.py`).
- `deploy/` — reference-only Docker/K8s/GitHub Actions docs (not active on Replit).

## Architecture decisions

- Auth is custom-built (session cookies, bcrypt), not a third-party provider. First registered user becomes `admin`; everyone after is `user`; `guest` is implicit for unauthenticated requests and never persisted.
- The graph (`/api/graph`) is computed from the relational schema in Postgres, not a dedicated graph database — kept swappable for a future Neo4j backend without changing the API contract.
- Caching is a hand-rolled in-process TTL Map, not Redis — fine for a single instance; documented as a scaling gap in the README roadmap.
- Table slugs auto-dedupe with an incrementing suffix on name collision rather than rejecting the create.
- Entry deletes explicitly cascade-delete relations in application code rather than relying solely on DB-level cascade config.

## Product

- **Graph explorer** (`/`): force-directed graph of entries, search-to-highlight, click-to-inspect detail panel, create relations (with weight + justification) directly from the panel.
- **Feature databases** (`/tables`, `/tables/:id`): create tables with a name/category/description, define a typed field schema (string/number/boolean/date/json, required flag), and add entries via a form generated from that schema (falls back to raw JSON editing).
- **Auth**: register/login/logout; guests can browse read-only, `user`/`admin` can create and delete data.

## User preferences

_None recorded yet._

## Gotchas

- `connect-pg-simple`'s `createTableIfMissing: true` fails under the esbuild-bundled server (it tries to read a `table.sql` file that isn't bundled). Keep it `false`; the `sessions` table already exists in the DB (created manually, not part of the Drizzle schema).
- Drizzle returns `Date` objects for timestamp columns but generated Zod response schemas expect ISO strings — every route wraps its response in the `toPlain()` helper (`src/lib/serialize.ts`) before `*Response.parse(...)`.
- Canvas 2D contexts (used in the graph renderer) cannot resolve CSS variables or `var(--...)` in `ctx.font`/`ctx.fillStyle` — always pass literal font/color values there, not theme tokens.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
