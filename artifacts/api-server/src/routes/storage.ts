import { Readable } from "stream";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, objectUploadIntentsTable } from "@workspace/db";

import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload. The client sends JSON metadata
 * (name, size, contentType) — NOT the file — then uploads the file directly
 * to the returned presigned URL. Requires a signed-in user so public callers
 * cannot mint write-capable URLs.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!req.currentUser) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    // Record that this exact objectPath was issued to this user, so a later
    // "confirm upload" call (e.g. creating a résumé version) can verify the
    // caller actually requested this object instead of trusting a
    // client-supplied path outright.
    await db.insert(objectUploadIntentsTable).values({
      objectPath,
      uploaderId: req.currentUser.id,
    });

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serves object entities from PRIVATE_OBJECT_DIR. Access control is delegated
 * to each object's stored ACL policy (see lib/objectAcl.ts) — objects marked
 * "public" (e.g. the current résumé) are served to everyone, others require
 * the caller to be the object's owner or an admin.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const canAccess = await objectStorageService.canAccessObjectEntity({
      userId: req.currentUser ? String(req.currentUser.id) : undefined,
      objectFile,
    });
    if (!canAccess) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
