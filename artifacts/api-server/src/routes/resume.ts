import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { db, resumeVersionsTable, objectUploadIntentsTable } from "@workspace/db";
import {
  CreateResumeVersionBody,
  CreateResumeVersionResponse,
  ListResumeVersionsResponse,
  GetCurrentResumeResponse,
  UpdateResumeVersionParams,
  UpdateResumeVersionBody,
  UpdateResumeVersionResponse,
  BulkDeleteResumeVersionsBody,
  BulkDeleteResumeVersionsResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { toPlain } from "../lib/serialize";
import { ObjectStorageService, UPLOAD_INTENT_TTL_MS } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_CONTENT_TYPES = new Set(["application/pdf"]);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

router.get("/resume/current", async (_req, res): Promise<void> => {
  const [current] = await db.select().from(resumeVersionsTable).where(eq(resumeVersionsTable.isCurrent, true));
  res.json(GetCurrentResumeResponse.parse({ current: current ? toPlain(current) : null }));
});

router.get("/resume/versions", requireRole("user", "admin"), async (_req, res): Promise<void> => {
  const versions = await db
    .select()
    .from(resumeVersionsTable)
    .orderBy(desc(resumeVersionsTable.createdAt));
  res.json(ListResumeVersionsResponse.parse(toPlain(versions)));
});

router.post("/resume/versions", requireRole("user", "admin"), async (req, res): Promise<void> => {
  const parsed = CreateResumeVersionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { objectPath, filename, contentType, sizeBytes, label } = parsed.data;

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    res.status(400).json({ error: "Only PDF files are accepted for résumé uploads" });
    return;
  }
  if (sizeBytes > MAX_SIZE_BYTES) {
    res.status(400).json({ error: "File exceeds the 10MB size limit" });
    return;
  }

  const currentUser = req.currentUser!;

  // Verify this exact objectPath was actually issued to this user by
  // /storage/uploads/request-url, and hasn't already been claimed. Without
  // this check, any signed-in user could point this endpoint at an
  // arbitrary (e.g. someone else's) existing objectPath, forcibly re-ACL it,
  // and later delete their own version row — deleting the shared object out
  // from under its real owner.
  const [intent] = await db
    .select()
    .from(objectUploadIntentsTable)
    .where(eq(objectUploadIntentsTable.objectPath, objectPath));

  if (
    !intent ||
    intent.uploaderId !== currentUser.id ||
    Date.now() - new Date(intent.createdAt).getTime() > UPLOAD_INTENT_TTL_MS
  ) {
    res.status(403).json({ error: "This upload was not requested by you or has expired" });
    return;
  }

  const [existingVersionForPath] = await db
    .select({ id: resumeVersionsTable.id })
    .from(resumeVersionsTable)
    .where(eq(resumeVersionsTable.objectPath, objectPath));
  if (existingVersionForPath) {
    res.status(409).json({ error: "This file has already been recorded" });
    return;
  }

  try {
    await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
      owner: String(currentUser.id),
      visibility: "public",
    });
  } catch (error) {
    req.log.error({ err: error }, "Failed to set ACL policy on uploaded résumé object");
    res.status(400).json({ error: "Uploaded file could not be found in storage" });
    return;
  }

  const version = await db.transaction(async (tx) => {
    // Consume the intent so this objectPath cannot be claimed again.
    const consumed = await tx
      .delete(objectUploadIntentsTable)
      .where(eq(objectUploadIntentsTable.objectPath, objectPath))
      .returning({ id: objectUploadIntentsTable.id });
    if (consumed.length === 0) {
      // Someone else consumed it concurrently between our check and here.
      return null;
    }

    const existingCurrent = await tx
      .select({ id: resumeVersionsTable.id })
      .from(resumeVersionsTable)
      .where(eq(resumeVersionsTable.isCurrent, true))
      .limit(1);

    const [inserted] = await tx
      .insert(resumeVersionsTable)
      .values({
        objectPath,
        filename,
        contentType,
        sizeBytes,
        label: label ?? null,
        uploaderId: currentUser.id,
        uploaderUsername: currentUser.username,
        isCurrent: existingCurrent.length === 0,
      })
      .returning();
    return inserted ?? null;
  });

  if (!version) {
    res.status(409).json({ error: "This upload has already been recorded" });
    return;
  }

  res.status(201).json(CreateResumeVersionResponse.parse(toPlain(version)));
});

router.patch("/resume/versions/:versionId", requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateResumeVersionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateResumeVersionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { versionId } = params.data;
  const { label, isCurrent } = parsed.data;

  const [existing] = await db.select().from(resumeVersionsTable).where(eq(resumeVersionsTable.id, versionId));
  if (!existing) {
    res.status(404).json({ error: "Résumé version not found" });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    if (isCurrent === true) {
      await tx.update(resumeVersionsTable).set({ isCurrent: false }).where(eq(resumeVersionsTable.isCurrent, true));
    }

    const patch: Partial<typeof resumeVersionsTable.$inferInsert> = {};
    if (label !== undefined) patch.label = label;
    if (isCurrent !== undefined) patch.isCurrent = isCurrent;

    if (Object.keys(patch).length === 0) {
      return existing;
    }

    const [row] = await tx
      .update(resumeVersionsTable)
      .set(patch)
      .where(eq(resumeVersionsTable.id, versionId))
      .returning();
    return row;
  });

  if (!updated) {
    res.status(404).json({ error: "Résumé version not found" });
    return;
  }

  res.json(UpdateResumeVersionResponse.parse(toPlain(updated)));
});

router.post("/resume/versions/bulk-delete", requireRole("user", "admin"), async (req, res): Promise<void> => {
  const parsed = BulkDeleteResumeVersionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { ids } = parsed.data;
  const currentUser = req.currentUser!;

  const rows = await db.select().from(resumeVersionsTable).where(inArray(resumeVersionsTable.id, ids));
  if (rows.length === 0) {
    res.json(BulkDeleteResumeVersionsResponse.parse({ deletedIds: [] }));
    return;
  }

  if (currentUser.role !== "admin") {
    const notOwned = rows.some((row) => row.uploaderId !== currentUser.id);
    if (notOwned) {
      res.status(403).json({ error: "You can only delete your own uploads" });
      return;
    }
  }

  const deletedWasCurrent = rows.some((row) => row.isCurrent);
  const deletedIds = rows.map((row) => row.id);

  await db.transaction(async (tx) => {
    await tx.delete(resumeVersionsTable).where(inArray(resumeVersionsTable.id, deletedIds));

    if (deletedWasCurrent) {
      const [nextCurrent] = await tx
        .select()
        .from(resumeVersionsTable)
        .orderBy(desc(resumeVersionsTable.createdAt))
        .limit(1);
      if (nextCurrent) {
        await tx.update(resumeVersionsTable).set({ isCurrent: true }).where(eq(resumeVersionsTable.id, nextCurrent.id));
      }
    }
  });

  for (const row of rows) {
    try {
      const file = await objectStorageService.getObjectEntityFile(row.objectPath);
      await file.delete();
    } catch (error) {
      req.log.warn({ err: error, objectPath: row.objectPath }, "Failed to delete résumé object from storage");
    }
  }

  res.json(BulkDeleteResumeVersionsResponse.parse({ deletedIds }));
});

export default router;
