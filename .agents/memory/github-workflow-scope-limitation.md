---
name: GitHub connector missing workflow scope
description: Any write (git push, Contents API, Git Data API) that touches .github/workflows/*.yml fails if the GitHub connector's OAuth token lacks the `workflow` scope.
---

# GitHub connector missing `workflow` scope

The Replit GitHub connector's granted OAuth scopes can be inspected via the `X-OAuth-Scopes` response header on any authenticated request (e.g. `GET /user`). If `workflow` is not in that list, GitHub rejects **any** write that creates or modifies a file under `.github/workflows/`, through every write path: plain `git push` (surfaces as a generic-looking `PUSH_REJECTED` from the `gitPush` tool), the Contents API (`PUT /repos/.../contents/...` returns `403`), and the Git Data API.

**Why:** GitHub enforces this at the platform level to stop apps from silently granting themselves CI/CD execution capability. It is not a bug in any Replit tool — same 403/rejection appears no matter which write mechanism is used.

**How to apply:** If a task requires publishing `.github/workflows/*.yml` to a repo via a Replit-managed GitHub connection and pushes are mysteriously rejected, check the connector's scopes first before assuming a tool bug. Push everything else normally; for the workflow files themselves, tell the user to either add them manually via the GitHub UI/CLI, or reauthorize the GitHub connection with the `workflow` scope if that becomes available.
