import { randomUUID } from "node:crypto";
import path from "node:path";
import { Router, type IRouter } from "express";
import AdmZip from "adm-zip";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, projectsTable, objectUploadIntentsTable } from "@workspace/db";
import {
  ListProjectsResponse,
  CreateProjectBody,
  CreateProjectResponse,
  GetProjectParams,
  GetProjectResponse,
  UpdateProjectParams,
  UpdateProjectBody,
  UpdateProjectResponse,
  DeleteProjectParams,
  ReorderProjectsBody,
  ReorderProjectsResponse,
  RegisterProjectSubappParams,
  RegisterProjectSubappBody,
  RegisterProjectSubappResponse,
  RemoveProjectSubappParams,
  RemoveProjectSubappResponse,
  GetProjectSubappStorageUsageResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { toPlain } from "../lib/serialize";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const MAX_ARCHIVE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB compressed
const MAX_UNCOMPRESSED_BYTES = 75 * 1024 * 1024; // 75MB extracted
const MAX_ARCHIVE_ENTRIES = 1000;

// Prefix every extracted sub-app lives under, shared across all projects.
// Used both to write a project's own bundle (subapps/<uuid>/...) and to sum
// total usage for the quota check below.
const SUBAPP_STORAGE_ROOT_PREFIX = "subapps/";

// Combined ceiling on how much extracted sub-app content all projects may
// occupy in the shared object storage bucket at once, regardless of how
// many times admins re-upload. Configurable via env so it can be tuned per
// deployment without a code change; defaults to 500MB.
const DEFAULT_MAX_TOTAL_SUBAPP_STORAGE_BYTES = 500 * 1024 * 1024;
const MAX_TOTAL_SUBAPP_STORAGE_BYTES = (() => {
  const raw = process.env.SUBAPP_STORAGE_QUOTA_BYTES;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOTAL_SUBAPP_STORAGE_BYTES;
})();

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
const ALLOWED_ARCHIVE_CONTENT_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".wasm": "application/wasm",
};

function mimeForPath(relPath: string): string {
  return MIME_BY_EXT[path.extname(relPath).toLowerCase()] ?? "application/octet-stream";
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : `project-${Date.now()}`;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let attempt = 1;
  while (true) {
    const existing = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.slug, slug));
    if (existing.length === 0) return slug;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
}

/** Verifies objectPath was actually issued to this user and hasn't already been claimed, then consumes it. */
async function claimUploadIntent(objectPath: string, userId: number): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const INTENT_TTL_MS = 60 * 60 * 1000;
  const [intent] = await db.select().from(objectUploadIntentsTable).where(eq(objectUploadIntentsTable.objectPath, objectPath));
  if (!intent || intent.uploaderId !== userId || Date.now() - new Date(intent.createdAt).getTime() > INTENT_TTL_MS) {
    return { ok: false, status: 403, error: "This upload was not requested by you or has expired" };
  }
  const consumed = await db
    .delete(objectUploadIntentsTable)
    .where(eq(objectUploadIntentsTable.objectPath, objectPath))
    .returning({ id: objectUploadIntentsTable.id });
  if (consumed.length === 0) {
    return { ok: false, status: 409, error: "This upload has already been claimed" };
  }
  return { ok: true };
}

router.get("/projects", async (_req, res): Promise<void> => {
  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(asc(projectsTable.sortOrder), desc(projectsTable.createdAt));
  res.json(ListProjectsResponse.parse(toPlain(projects)));
});

router.post("/projects", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const currentUser = req.currentUser!;
  const { name, description, thumbnailObjectPath, githubUrl, demoUrl } = parsed.data;

  if (thumbnailObjectPath) {
    const claim = await claimUploadIntent(thumbnailObjectPath, currentUser.id);
    if (!claim.ok) {
      res.status(claim.status).json({ error: claim.error });
      return;
    }
    try {
      await objectStorageService.trySetObjectEntityAclPolicy(thumbnailObjectPath, {
        owner: String(currentUser.id),
        visibility: "public",
      });
    } catch (error) {
      req.log.error({ err: error }, "Failed to set ACL policy on project thumbnail");
      res.status(400).json({ error: "Thumbnail file could not be found in storage" });
      return;
    }
  }

  const slug = await uniqueSlug(name);

  // New projects land at the end of the admin-defined order rather than
  // jumping to the front (sortOrder ascending = display order).
  const [{ maxSortOrder }] = await db
    .select({ maxSortOrder: sql<number>`coalesce(max(${projectsTable.sortOrder}), -1)` })
    .from(projectsTable);

  const [project] = await db
    .insert(projectsTable)
    .values({
      slug,
      name,
      description,
      thumbnailObjectPath: thumbnailObjectPath ?? null,
      githubUrl: githubUrl ?? null,
      demoUrl: demoUrl ?? null,
      demoType: demoUrl ? "external" : "none",
      sortOrder: Number(maxSortOrder) + 1,
      ownerId: currentUser.id,
      ownerUsername: currentUser.username,
    })
    .returning();

  if (!project) {
    req.log.error("Insert returned no row for new project");
    res.status(500).json({ error: "Failed to create project" });
    return;
  }

  res.status(201).json(CreateProjectResponse.parse(toPlain(project)));
});

// Registered before "/projects/:projectId" so that literal path segment
// takes precedence over the numeric id param during route matching.
router.patch("/projects/reorder", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = ReorderProjectsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ids } = parsed.data;
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    res.status(400).json({ error: "Duplicate project id in reorder list" });
    return;
  }

  const existing = await db.select({ id: projectsTable.id }).from(projectsTable);
  const existingIds = new Set(existing.map((p) => p.id));
  if (existingIds.size !== uniqueIds.size || [...uniqueIds].some((id) => !existingIds.has(id))) {
    res.status(400).json({ error: "ids must exactly match the current set of project ids" });
    return;
  }

  await Promise.all(
    ids.map((id, index) => db.update(projectsTable).set({ sortOrder: index }).where(eq(projectsTable.id, id))),
  );

  const projects = await db
    .select()
    .from(projectsTable)
    .orderBy(asc(projectsTable.sortOrder), desc(projectsTable.createdAt));
  res.json(ReorderProjectsResponse.parse(toPlain(projects)));
});

// Registered before "/projects/:projectId" so that literal path segment
// takes precedence over the numeric id param during route matching.
router.get("/projects/subapp-storage", requireRole("admin"), async (_req, res): Promise<void> => {
  const usedBytes = await objectStorageService.getTotalSizeUnderPrefix(SUBAPP_STORAGE_ROOT_PREFIX);
  res.json(
    GetProjectSubappStorageUsageResponse.parse({
      usedBytes,
      quotaBytes: MAX_TOTAL_SUBAPP_STORAGE_BYTES,
    }),
  );
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(GetProjectResponse.parse(toPlain(project)));
});

router.patch("/projects/:projectId", requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = req.currentUser!;
  const [existing] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { name, description, thumbnailObjectPath, githubUrl, demoUrl } = parsed.data;
  const patch: Partial<typeof projectsTable.$inferInsert> = {};

  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (githubUrl !== undefined) patch.githubUrl = githubUrl;

  let oldThumbnailToDelete: string | null = null;
  if (thumbnailObjectPath !== undefined && thumbnailObjectPath !== existing.thumbnailObjectPath) {
    if (thumbnailObjectPath) {
      const claim = await claimUploadIntent(thumbnailObjectPath, currentUser.id);
      if (!claim.ok) {
        res.status(claim.status).json({ error: claim.error });
        return;
      }
      try {
        await objectStorageService.trySetObjectEntityAclPolicy(thumbnailObjectPath, {
          owner: String(currentUser.id),
          visibility: "public",
        });
      } catch (error) {
        req.log.error({ err: error }, "Failed to set ACL policy on project thumbnail");
        res.status(400).json({ error: "Thumbnail file could not be found in storage" });
        return;
      }
    }
    oldThumbnailToDelete = existing.thumbnailObjectPath;
    patch.thumbnailObjectPath = thumbnailObjectPath;
  }

  if (demoUrl !== undefined) {
    patch.demoUrl = demoUrl;
    // Never downgrade a registered sub-app demo just because the external
    // link field was edited — admins remove the sub-app explicitly first.
    if (existing.demoType !== "subapp") {
      patch.demoType = demoUrl ? "external" : "none";
    }
  }

  const [updated] = await db.update(projectsTable).set(patch).where(eq(projectsTable.id, existing.id)).returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (oldThumbnailToDelete) {
    try {
      const file = await objectStorageService.getObjectEntityFile(oldThumbnailToDelete);
      await file.delete();
    } catch (error) {
      req.log.warn({ err: error, objectPath: oldThumbnailToDelete }, "Failed to delete old project thumbnail");
    }
  }

  res.json(UpdateProjectResponse.parse(toPlain(updated)));
});

router.delete("/projects/:projectId", requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db.delete(projectsTable).where(eq(projectsTable.id, params.data.projectId)).returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (project.thumbnailObjectPath) {
    try {
      const file = await objectStorageService.getObjectEntityFile(project.thumbnailObjectPath);
      await file.delete();
    } catch (error) {
      req.log.warn({ err: error, objectPath: project.thumbnailObjectPath }, "Failed to delete project thumbnail");
    }
  }
  if (project.subappObjectPrefix) {
    await objectStorageService.deleteObjectsUnderPrefix(project.subappObjectPrefix).catch((error) => {
      req.log.warn({ err: error, prefix: project.subappObjectPrefix }, "Failed to delete project sub-app files");
    });
  }

  res.sendStatus(204);
});

router.post("/projects/:projectId/subapp", requireRole("admin"), async (req, res): Promise<void> => {
  const params = RegisterProjectSubappParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RegisterProjectSubappBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = req.currentUser!;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { objectPath, filename, contentType, sizeBytes } = parsed.data;

  if (!filename.toLowerCase().endsWith(".zip")) {
    res.status(400).json({ error: "Only .zip archives are accepted" });
    return;
  }
  if (!ALLOWED_ARCHIVE_CONTENT_TYPES.has(contentType)) {
    res.status(400).json({ error: "Only .zip archives are accepted" });
    return;
  }
  if (sizeBytes > MAX_ARCHIVE_SIZE_BYTES) {
    res.status(400).json({ error: `Archive exceeds the ${MAX_ARCHIVE_SIZE_BYTES / (1024 * 1024)}MB size limit` });
    return;
  }

  const claim = await claimUploadIntent(objectPath, currentUser.id);
  if (!claim.ok) {
    res.status(claim.status).json({ error: claim.error });
    return;
  }

  let archiveFile;
  let archiveBuffer: Buffer;
  try {
    archiveFile = await objectStorageService.getObjectEntityFile(objectPath);
    [archiveBuffer] = await archiveFile.download();
  } catch (error) {
    req.log.error({ err: error }, "Failed to download uploaded archive");
    res.status(400).json({ error: "Uploaded archive could not be found in storage" });
    return;
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(archiveBuffer);
  } catch (error) {
    res.status(400).json({ error: "Uploaded file is not a valid .zip archive" });
    return;
  }

  const entries = zip.getEntries().filter((entry) => !entry.isDirectory);
  if (entries.length === 0) {
    res.status(400).json({ error: "Archive is empty" });
    return;
  }
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    res.status(400).json({ error: `Archive contains too many files (max ${MAX_ARCHIVE_ENTRIES})` });
    return;
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    const name = entry.entryName;
    if (name.startsWith("/") || name.split("/").some((seg) => seg === "..")) {
      res.status(400).json({ error: `Archive contains an unsafe path: ${name}` });
      return;
    }
    // Reject symlinks: unix mode is packed into the top 16 bits of external attributes.
    const unixMode = (entry.header.attr >>> 16) & 0xffff;
    const isSymlink = (unixMode & 0xf000) === 0xa000;
    if (isSymlink) {
      res.status(400).json({ error: `Archive contains a symlink, which is not allowed: ${name}` });
      return;
    }
    totalUncompressed += entry.header.size;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      res.status(400).json({ error: `Archive is too large when extracted (max ${MAX_UNCOMPRESSED_BYTES / (1024 * 1024)}MB)` });
      return;
    }
  }

  // Enforce a combined ceiling across every project's sub-app before extracting
  // anything, so no single project (or repeated re-uploads to the same one) can
  // gradually exhaust the shared object storage bucket. The previous bundle for
  // *this* project (if any) is about to be replaced, so it's netted out of the
  // current usage rather than counted twice.
  const previousPrefix = project.subappObjectPrefix;
  const [currentTotalUsage, previousPrefixSize] = await Promise.all([
    objectStorageService.getTotalSizeUnderPrefix(SUBAPP_STORAGE_ROOT_PREFIX),
    previousPrefix ? objectStorageService.getTotalSizeUnderPrefix(previousPrefix) : Promise.resolve(0),
  ]);
  const projectedTotalUsage = currentTotalUsage - previousPrefixSize + totalUncompressed;
  if (projectedTotalUsage > MAX_TOTAL_SUBAPP_STORAGE_BYTES) {
    res.status(400).json({
      error:
        `This upload would push total sub-app storage to ${formatMB(projectedTotalUsage)}MB, ` +
        `over the ${formatMB(MAX_TOTAL_SUBAPP_STORAGE_BYTES)}MB shared quota. ` +
        "Remove an existing sub-app or use a smaller archive.",
    });
    return;
  }

  // If every entry shares one common top-level directory (typical of "zip this folder"),
  // strip it so the sub-app's index.html ends up at the prefix root.
  const topDirs = new Set(
    entries.map((entry) => {
      const idx = entry.entryName.indexOf("/");
      return idx === -1 ? "" : entry.entryName.slice(0, idx);
    }),
  );
  const [onlyTopDir] = topDirs;
  const commonRoot = topDirs.size === 1 && onlyTopDir !== "" ? onlyTopDir! : null;

  function relativize(entryName: string): string {
    if (commonRoot && entryName.startsWith(`${commonRoot}/`)) {
      return entryName.slice(commonRoot.length + 1);
    }
    return entryName;
  }

  const hasEntrypoint = entries.some((entry) => relativize(entry.entryName).toLowerCase() === "index.html");
  if (!hasEntrypoint) {
    res.status(400).json({ error: "Archive must contain an index.html at its root (or inside a single top-level folder)" });
    return;
  }

  const prefix = `subapps/${randomUUID()}`;
  try {
    for (const entry of entries) {
      const relPath = relativize(entry.entryName);
      if (!relPath) continue;
      const data = entry.getData();
      await objectStorageService.writeObjectEntity(`${prefix}/${relPath}`, data, mimeForPath(relPath));
    }
  } catch (error) {
    req.log.error({ err: error }, "Failed to extract project sub-app archive");
    await objectStorageService.deleteObjectsUnderPrefix(prefix).catch(() => {});
    res.status(500).json({ error: "Failed to extract archive" });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ demoType: "subapp", subappObjectPrefix: prefix, subappEntrypoint: "index.html" })
    .where(eq(projectsTable.id, project.id))
    .returning();

  // Clean up the now-consumed archive and any previously-hosted sub-app files.
  await archiveFile.delete().catch((error) => req.log.warn({ err: error }, "Failed to delete consumed archive"));
  if (previousPrefix) {
    await objectStorageService.deleteObjectsUnderPrefix(previousPrefix).catch((error) => {
      req.log.warn({ err: error, prefix: previousPrefix }, "Failed to delete previous sub-app files");
    });
  }

  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(RegisterProjectSubappResponse.parse(toPlain(updated)));
});

router.delete("/projects/:projectId/subapp", requireRole("admin"), async (req, res): Promise<void> => {
  const params = RemoveProjectSubappParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (project.subappObjectPrefix) {
    await objectStorageService.deleteObjectsUnderPrefix(project.subappObjectPrefix).catch((error) => {
      req.log.warn({ err: error, prefix: project.subappObjectPrefix }, "Failed to delete sub-app files");
    });
  }

  const [updated] = await db
    .update(projectsTable)
    .set({
      demoType: project.demoUrl ? "external" : "none",
      subappObjectPrefix: null,
      subappEntrypoint: null,
    })
    .where(eq(projectsTable.id, project.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(RemoveProjectSubappResponse.parse(toPlain(updated)));
});

/**
 * GET /projects/:projectId/subapp/*path
 *
 * Serves an extracted sub-app's static files. Intentionally public and
 * bypasses the object ACL system used by /storage/objects/* — these files
 * only exist to be a public, read-only demo, scoped to this project's own
 * storage prefix so it can never read another project's or the main app's
 * files.
 */
router.get(
  ["/projects/:projectId/subapp", "/projects/:projectId/subapp/", "/projects/:projectId/subapp/*path"],
  async (req, res): Promise<void> => {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId)) {
      res.status(400).json({ error: "Invalid project id" });
      return;
    }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project || !project.subappObjectPrefix) {
      res.status(404).json({ error: "This project has no hosted sub-app" });
      return;
    }

    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw || "";
    const entrypoint = project.subappEntrypoint ?? "index.html";
    const requestedRelPath = wildcardPath || entrypoint;

    if (requestedRelPath.split("/").some((seg) => seg === "..")) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }

    async function serve(relPath: string): Promise<boolean> {
      try {
        const file = await objectStorageService.getObjectEntityFile(`/objects/${project!.subappObjectPrefix}/${relPath}`);
        const [metadata] = await file.getMetadata();
        const [data] = await file.download();
        res.setHeader("Content-Type", (metadata.contentType as string) || mimeForPath(relPath));
        res.setHeader("Cache-Control", "private, max-age=60");
        res.send(data);
        return true;
      } catch {
        return false;
      }
    }

    if (await serve(requestedRelPath)) return;

    // SPA-style fallback: an extensionless path that isn't a real file falls
    // back to the entrypoint so client-side routing inside the sub-app works.
    if (!path.extname(requestedRelPath) && (await serve(entrypoint))) return;

    res.status(404).json({ error: "File not found in this project's sub-app" });
  },
);

export default router;
