# Deployment reference (not used on Replit)

Everything under `deploy/` is **reference material only**. This project runs
and is published entirely through Replit's own deployment system (see the
[Deployment section](../README.md#deployment) of the root README) — nothing
in this folder is wired up, tested, or required for that to work.

It exists to answer "how would this run on more traditional infrastructure?"
for anyone taking the codebase off Replit: a container image for the API
server, a Compose file to run the whole stack locally, Kubernetes manifests
for a cluster deployment, and a GitHub Actions CI workflow. None of it is
exercised by any build or test in this repo.

- `docker/Dockerfile.api-server` — multi-stage build for the Express API.
- `docker/docker-compose.yml` — API server + Postgres for local/self-hosted use.
- `k8s/` — Deployment + Service manifests for the API server.
- `github-actions/ci.yml` — typecheck/build workflow (copy into `.github/workflows/`
  yourself if you fork this off Replit; it is not active here).
