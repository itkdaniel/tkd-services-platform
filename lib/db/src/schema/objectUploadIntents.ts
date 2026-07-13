import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Tracks presigned upload URLs that have been issued to a specific user for a
 * specific object path, so that a later "confirm this upload" API call (e.g.
 * creating a résumé version) can be validated server-side instead of trusting
 * a client-supplied objectPath outright.
 *
 * A row is created when `/storage/uploads/request-url` issues a presigned
 * URL, and consumed (deleted) when the corresponding confirm endpoint
 * successfully records the upload. This prevents a signed-in user from
 * pointing a "confirm" call at an objectPath they never uploaded to (e.g. an
 * existing object belonging to someone else), which would otherwise let them
 * hijack that object's ACL or trigger deletion of a shared file.
 */
export const objectUploadIntentsTable = pgTable("object_upload_intents", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull().unique(),
  uploaderId: integer("uploader_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
