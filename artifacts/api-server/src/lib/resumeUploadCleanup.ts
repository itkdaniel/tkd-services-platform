import { inArray, lt } from "drizzle-orm";
import { db, resumeVersionsTable, objectUploadIntentsTable, projectsTable } from "@workspace/db";

import { ObjectStorageService, UPLOAD_INTENT_TTL_MS } from "./objectStorage";
import { logger } from "./logger";
import { sendAdminNotification } from "./adminNotify";

// Every direct-to-storage upload (résumé PDFs, project thumbnails, project
// sub-app archives) goes through the same two-step flow: the browser PUTs the
// file to object storage under this shared prefix, then a "confirm" API call
// records it against a specific row (resume_versions.objectPath or
// projects.thumbnailObjectPath). If the confirm step never happens (closed
// tab, dropped connection, failed request), the object sits in storage
// forever with nothing pointing to it. This sweep reclaims those orphans.
//
// IMPORTANT: this prefix is shared across features. An object is only safe
// to delete if it is unreferenced by *every* table that can point into it —
// adding a new upload consumer means adding its reference column below.
const UPLOAD_PREFIX = "uploads/";

export interface SweepResult {
  deletedObjects: number;
  deletedIntents: number;
}

/**
 * Deletes object-storage files under the shared uploads/ prefix that are
 * older than the confirm-step TTL and have no matching reference in any
 * table that can point into that prefix (résumé versions, project
 * thumbnails), plus any upload-intent DB rows past that same TTL (which —
 * since a successful confirm always consumes its intent — are guaranteed to
 * belong to uploads that were never confirmed).
 */
export async function sweepOrphanedResumeUploads(
  objectStorageService: ObjectStorageService = new ObjectStorageService(),
): Promise<SweepResult> {
  const cutoff = new Date(Date.now() - UPLOAD_INTENT_TTL_MS);

  const objects = await objectStorageService.listObjectEntitiesUnderPrefix(UPLOAD_PREFIX);
  const stale = objects.filter((object) => object.timeCreated < cutoff);

  let deletedObjects = 0;
  if (stale.length > 0) {
    const stalePaths = stale.map((object) => object.objectPath);

    // Check every table that can hold a long-lived reference into the shared
    // uploads/ prefix, not just résumé versions — project thumbnails also
    // point here and must never be swept up as "orphaned".
    const [referencedByResume, referencedByThumbnail] = await Promise.all([
      db
        .select({ objectPath: resumeVersionsTable.objectPath })
        .from(resumeVersionsTable)
        .where(inArray(resumeVersionsTable.objectPath, stalePaths)),
      db
        .select({ objectPath: projectsTable.thumbnailObjectPath })
        .from(projectsTable)
        .where(inArray(projectsTable.thumbnailObjectPath, stalePaths)),
    ]);
    const referenced = new Set([
      ...referencedByResume.map((row) => row.objectPath),
      ...referencedByThumbnail.map((row) => row.objectPath).filter((path): path is string => path !== null),
    ]);

    for (const object of stale) {
      if (referenced.has(object.objectPath)) continue;
      try {
        await object.file.delete();
        deletedObjects++;
      } catch (error) {
        logger.warn({ err: error, objectPath: object.objectPath }, "Failed to delete orphaned résumé upload object");
      }
    }
  }

  const deletedIntents = await db
    .delete(objectUploadIntentsTable)
    .where(lt(objectUploadIntentsTable.createdAt, cutoff))
    .returning({ id: objectUploadIntentsTable.id });

  if (deletedObjects > 0 || deletedIntents.length > 0) {
    logger.info(
      { deletedObjects, deletedIntents: deletedIntents.length },
      "Swept orphaned uploads",
    );
  }

  return { deletedObjects, deletedIntents: deletedIntents.length };
}

// Number of consecutive sweep failures before an admin alert is sent.
// After the threshold is crossed the alert fires once per streak — it is
// not repeated on every subsequent failure unless the streak resets.
export const CLEANUP_FAILURE_ALERT_THRESHOLD = 3;

/**
 * Starts a recurring background sweep. Intended to be called once from the
 * process entrypoint (not from app.ts, so tests that import the Express app
 * don't spin up a timer). Runs once immediately, then on `intervalMs`.
 *
 * When the sweep throws on CLEANUP_FAILURE_ALERT_THRESHOLD consecutive runs
 * an admin-notification email is sent so the problem surfaces outside logs.
 * The alert fires once at the threshold and is not repeated until the sweep
 * recovers (streak resets to zero) and then fails again.
 *
 * @param intervalMs  How often to run the sweep (default: 1 hour).
 * @param sweepFn     Override for the sweep function — used in tests to inject
 *                    a controlled implementation without touching real storage.
 */
export function startResumeUploadCleanupJob(
  intervalMs: number = 60 * 60 * 1000,
  sweepFn: () => Promise<SweepResult> = sweepOrphanedResumeUploads,
): NodeJS.Timeout {
  let consecutiveFailures = 0;

  const run = () => {
    sweepFn()
      .then(() => {
        if (consecutiveFailures > 0) {
          logger.info(
            { previousConsecutiveFailures: consecutiveFailures },
            "Résumé upload cleanup sweep recovered",
          );
        }
        consecutiveFailures = 0;
      })
      .catch((error) => {
        consecutiveFailures++;
        logger.error(
          { err: error, consecutiveFailures },
          "Résumé upload cleanup sweep failed",
        );

        if (consecutiveFailures === CLEANUP_FAILURE_ALERT_THRESHOLD) {
          const subject = "⚠️ Résumé upload cleanup sweep is repeatedly failing";
          const body =
            `The orphaned-upload cleanup sweep has failed ${consecutiveFailures} consecutive times.\n\n` +
            `Last error: ${error instanceof Error ? error.message : String(error)}\n\n` +
            `Check the API server logs for details. The sweep runs every ${Math.round(intervalMs / 60_000)} minute(s).`;

          sendAdminNotification(subject, body).catch((notifyError) => {
            logger.error({ err: notifyError }, "Failed to send cleanup-failure admin notification");
          });
        }
      });
  };

  run();
  return setInterval(run, intervalMs);
}
