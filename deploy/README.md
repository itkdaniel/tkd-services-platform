# Deployment reference (not run on Replit)

Everything under `deploy/` is tooling for running TKD Services **outside**
Replit — on your own server, a VPS, or any Docker host. It is not exercised
by anything in this Repl: this dev environment runs the app through the
workflows described in the root [README](../README.md) and is published
through Replit's own deployment system, not through any of these files.

That said, it is real, working self-host tooling (not aspirational), meant
to be copied into a machine that actually has Docker/Kubernetes:

- `docker/Dockerfile.api-server` — multi-stage build for the Express API
  server (main app backend).
- `docker/Dockerfile.web` — multi-stage build for the `tkd-services`
  frontend (Vite build, served with `vite preview`).
- `../docker-compose.yml` (root of the repo) — the whole stack: both
  Postgres databases, the API server, the frontend, and the booking
  microservice, wired together with the same env vars used in production.
- `k8s/` — Deployment + Service manifests for the API server, for anyone
  running a cluster instead of Compose.
- `github-actions/ci.yml` — a copy of the CI workflow that's actually active
  at `.github/workflows/ci.yml`, kept here for reference since forks that
  strip `.github/` sometimes want a starting point.

See the root README's "Running via Docker Compose (self-hosted)" section for
the full walkthrough, including the one real limitation: résumé/portfolio
image uploads use Replit's built-in Object Storage sidecar, which isn't
present outside Replit. Self-hosting that feature means pointing
`@google-cloud/storage` at a real GCS bucket (or swapping in a different
storage backend) — not something this reference config does for you.

The standalone `artifacts/booking-service` microservice also has its own
Dockerfile and is published as its own repository
(https://github.com/itkdaniel/tkd-booking-service) so it can be dropped into
a different project without any of this.
