---
name: Checking out a subtree/partial branch in the main workspace deletes unrelated files
description: `git checkout <subtree-split-branch>` in the primary working tree removes every file not in that branch's tree, which can cascade into the artifact system deregistering artifacts whose directories briefly disappear.
---

# Never `git checkout` a subtree/partial-tree branch in the main workspace

`git subtree split --prefix=<dir> -b <branch>` creates a branch whose tree contains *only* files under `<dir>`. Running `git checkout <branch>` in the main workspace (not a separate worktree) replaces the working tree with that narrow tree — every other file/directory in the project is deleted from disk for as long as that branch is checked out.

**Why:** This isn't just a git-history concern — the live filesystem changes. In this workspace, the artifact-tracking system watches artifact directories and reacts to a directory's disappearance by deregistering that artifact (removing it from `listArtifacts()` and tearing down its workflow), even if you check out back to `main` moments later. Restoring the working tree with `git checkout -f main` puts the files back, but does **not** automatically re-register artifacts that got deregistered in between.

**How to apply:** To extract/publish a subdirectory as its own repo, do it without ever checking out the split branch in the primary workspace: `git worktree add <path> <branch>` and push from that separate directory, or read/hash files directly (e.g. via the GitHub Contents/Git Data API) instead of `git checkout`. If a subtree-split branch was created by mistake, `git branch -D` it without checking it out.
