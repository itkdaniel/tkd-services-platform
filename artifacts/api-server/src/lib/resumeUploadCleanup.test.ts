import { describe, it, expect, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, objectUploadIntentsTable, resumeVersionsTable, projectsTable } from "@workspace/db";

import { createUser, deleteUsersByIds, deleteResumeVersionsByIds, unique } from "../test/helpers";
import { sweepOrphanedResumeUploads } from "./resumeUploadCleanup";

const HOUR_MS = 60 * 60 * 1000;

function makeFakeFile(deleteImpl = vi.fn(async () => {})) {
  return { delete: deleteImpl };
}

/** Builds a fake ObjectStorageService whose listing returns the given fixed set of objects. */
function fakeObjectStorageService(objects: Array<{ objectPath: string; file: { delete: () => Promise<void> }; timeCreated: Date }>) {
  return { listObjectEntitiesUnderPrefix: vi.fn(async () => objects) } as unknown as import("./objectStorage").ObjectStorageService;
}

describe("sweepOrphanedResumeUploads", () => {
  const createdUserIds: number[] = [];
  const createdVersionIds: number[] = [];

  afterAll(async () => {
    await deleteResumeVersionsByIds(createdVersionIds);
    await deleteUsersByIds(createdUserIds);
  });

  it("deletes a storage object that is old and has no matching résumé version", async () => {
    const oldObjectPath = `/objects/uploads/${unique("orphan")}`;
    const deleteSpy = vi.fn(async () => {});
    const service = fakeObjectStorageService([
      { objectPath: oldObjectPath, file: makeFakeFile(deleteSpy), timeCreated: new Date(Date.now() - 2 * HOUR_MS) },
    ]);

    const result = await sweepOrphanedResumeUploads(service);

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(result.deletedObjects).toBe(1);
  });

  it("leaves a recently uploaded object alone (might still be mid-confirm)", async () => {
    const recentObjectPath = `/objects/uploads/${unique("recent")}`;
    const deleteSpy = vi.fn(async () => {});
    const service = fakeObjectStorageService([
      { objectPath: recentObjectPath, file: makeFakeFile(deleteSpy), timeCreated: new Date() },
    ]);

    const result = await sweepOrphanedResumeUploads(service);

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(result.deletedObjects).toBe(0);
  });

  it("does not delete an old object that was successfully confirmed as a résumé version", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const confirmedObjectPath = `/objects/uploads/${unique("confirmed")}`;
    const [version] = await db
      .insert(resumeVersionsTable)
      .values({
        objectPath: confirmedObjectPath,
        filename: "resume.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
        uploaderId: user.id,
        uploaderUsername: user.username,
        isCurrent: false,
      })
      .returning();
    createdVersionIds.push(version!.id);

    const deleteSpy = vi.fn(async () => {});
    const service = fakeObjectStorageService([
      { objectPath: confirmedObjectPath, file: makeFakeFile(deleteSpy), timeCreated: new Date(Date.now() - 2 * HOUR_MS) },
    ]);

    const result = await sweepOrphanedResumeUploads(service);

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(result.deletedObjects).toBe(0);
  });

  it("does not delete an old object that is referenced as a project thumbnail", async () => {
    const admin = await createUser("admin");
    createdUserIds.push(admin.id);
    const thumbnailObjectPath = `/objects/uploads/${unique("thumbnail")}`;
    const [project] = await db
      .insert(projectsTable)
      .values({
        slug: unique("cleanup-test-project"),
        name: "Cleanup Test Project",
        description: "temp",
        thumbnailObjectPath,
        ownerId: admin.id,
        ownerUsername: admin.username,
      })
      .returning();

    try {
      const deleteSpy = vi.fn(async () => {});
      const service = fakeObjectStorageService([
        { objectPath: thumbnailObjectPath, file: makeFakeFile(deleteSpy), timeCreated: new Date(Date.now() - 2 * HOUR_MS) },
      ]);

      const result = await sweepOrphanedResumeUploads(service);

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(result.deletedObjects).toBe(0);
    } finally {
      await db.delete(projectsTable).where(eq(projectsTable.id, project!.id));
    }
  });

  it("clears out an expired, never-confirmed upload intent row", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const objectPath = `/objects/uploads/${unique("expired-intent")}`;
    await db.insert(objectUploadIntentsTable).values({ objectPath, uploaderId: user.id });
    // Backdate it past the TTL directly, since the row is inserted with defaultNow().
    await db
      .update(objectUploadIntentsTable)
      .set({ createdAt: new Date(Date.now() - 2 * HOUR_MS) })
      .where(eq(objectUploadIntentsTable.objectPath, objectPath));

    const service = fakeObjectStorageService([]);
    const result = await sweepOrphanedResumeUploads(service);
    expect(result.deletedIntents).toBeGreaterThanOrEqual(1);

    const [remaining] = await db
      .select()
      .from(objectUploadIntentsTable)
      .where(eq(objectUploadIntentsTable.objectPath, objectPath));
    expect(remaining).toBeUndefined();
  });

  it("keeps a fresh, still-pending upload intent row", async () => {
    const user = await createUser("user");
    createdUserIds.push(user.id);
    const objectPath = `/objects/uploads/${unique("fresh-intent")}`;
    await db.insert(objectUploadIntentsTable).values({ objectPath, uploaderId: user.id });

    const service = fakeObjectStorageService([]);
    await sweepOrphanedResumeUploads(service);

    const [remaining] = await db
      .select()
      .from(objectUploadIntentsTable)
      .where(eq(objectUploadIntentsTable.objectPath, objectPath));
    expect(remaining).toBeDefined();

    await db.delete(objectUploadIntentsTable).where(eq(objectUploadIntentsTable.objectPath, objectPath));
  });
});
