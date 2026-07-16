import { describe, it, expect, afterAll, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, objectUploadIntentsTable, resumeVersionsTable, projectsTable } from "@workspace/db";

import { createUser, deleteUsersByIds, deleteResumeVersionsByIds, unique } from "../test/helpers";
import { sweepOrphanedResumeUploads, startResumeUploadCleanupJob, CLEANUP_FAILURE_ALERT_THRESHOLD, type SweepResult } from "./resumeUploadCleanup";
import { sendAdminNotification } from "./adminNotify";

// Mock the admin notification module so tests can assert alert calls without
// requiring email credentials or a real transport.
vi.mock("./adminNotify", () => ({
  sendAdminNotification: vi.fn(async () => {}),
  notifyAdminOfResumeUpload: vi.fn(async () => {}),
}));

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

describe("startResumeUploadCleanupJob — consecutive-failure alerting", () => {
  const notifySpy = () => vi.mocked(sendAdminNotification);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(sendAdminNotification).mockClear();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  /**
   * Advances the fake clock by `ticks` intervals, flushing async microtasks
   * between each tick so sweep Promises settle before the next tick fires.
   */
  async function advanceTicks(intervalMs: number, ticks: number) {
    for (let i = 0; i < ticks; i++) {
      await vi.advanceTimersByTimeAsync(intervalMs);
    }
  }

  it("does not send a notification when fewer than the threshold failures have occurred", async () => {
    const failingSweep = vi.fn(async (): Promise<never> => {
      throw new Error("storage unavailable");
    });

    // Total invocations = 1 (immediate) + (THRESHOLD-2) ticks = THRESHOLD-1 — stays under threshold.
    const interval = startResumeUploadCleanupJob(100, failingSweep);
    await advanceTicks(100, CLEANUP_FAILURE_ALERT_THRESHOLD - 2);
    clearInterval(interval);

    expect(notifySpy()).not.toHaveBeenCalled();
  });

  it("sends exactly one notification when the failure threshold is first crossed", async () => {
    const failingSweep = vi.fn(async (): Promise<never> => {
      throw new Error("DB connection lost");
    });

    // Total invocations = 1 (immediate) + (THRESHOLD + 1) ticks = THRESHOLD + 2,
    // ensuring we cross and then exceed the threshold without resetting.
    const interval = startResumeUploadCleanupJob(100, failingSweep);
    await advanceTicks(100, CLEANUP_FAILURE_ALERT_THRESHOLD + 1);
    clearInterval(interval);

    // Alert fires exactly once — at the threshold, not on every subsequent failure.
    expect(notifySpy()).toHaveBeenCalledTimes(1);
    const [subject] = notifySpy().mock.calls[0]!;
    expect(subject).toMatch(/cleanup sweep/i);
  });

  it("resets the streak on a successful sweep and re-alerts after a new streak", async () => {
    let callCount = 0;
    const controlledSweep = vi.fn(async (): Promise<SweepResult> => {
      callCount++;
      // First THRESHOLD calls fail
      if (callCount <= CLEANUP_FAILURE_ALERT_THRESHOLD) throw new Error("first streak");
      // One success — resets the consecutive-failure counter
      if (callCount === CLEANUP_FAILURE_ALERT_THRESHOLD + 1) return { deletedObjects: 0, deletedIntents: 0 };
      // Second streak fails again
      throw new Error("second streak");
    });

    // Drive through: THRESHOLD failures + 1 success + THRESHOLD more failures.
    // Total ticks after the immediate first call: THRESHOLD * 2
    const interval = startResumeUploadCleanupJob(100, controlledSweep);
    await advanceTicks(100, CLEANUP_FAILURE_ALERT_THRESHOLD * 2);
    clearInterval(interval);

    // One alert per streak that crosses the threshold
    expect(notifySpy()).toHaveBeenCalledTimes(2);
  });
});
