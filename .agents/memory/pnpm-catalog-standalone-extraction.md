---
name: pnpm workspace catalog: specifiers break when extracting a package standalone
description: A package.json using `"dep": "catalog:"` only resolves inside the monorepo's pnpm-workspace.yaml; resolve to concrete versions before publishing that package as its own standalone repo.
---

# Resolve `catalog:` specifiers before extracting a package to a standalone repo

pnpm workspace catalogs let a package's `package.json` say `"drizzle-orm": "catalog:"` and have the version resolved from the root `pnpm-workspace.yaml`'s `catalog:` block. This only works inside the monorepo. If you extract one `artifacts/<pkg>` directory into its own standalone repo (e.g. for external publishing), any dependency still pinned to `catalog:` will fail to install there — there's no workspace file to resolve it from.

**Why:** `catalog:` is workspace-relative syntax, not a valid semver range on its own; npm/pnpm outside the workspace context can't install it.

**How to apply:** Before publishing an extracted package standalone, look up each `catalog:` entry's real version in the root `pnpm-workspace.yaml` and hardcode it into the standalone `package.json`. Leave the original in-monorepo `package.json` using `catalog:` unchanged.
