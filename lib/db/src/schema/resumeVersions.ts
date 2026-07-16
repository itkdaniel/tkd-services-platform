import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// One row per uploaded résumé file. `isCurrent` marks the version shown to
// visitors; at most one row should have isCurrent = true at any time (enforced
// in application code via a transaction, not a DB constraint).
// `reviewedAt` is set (to now) the first time an admin opens the version history
// after the upload. Null means the upload has not yet been seen by an admin.
export const resumeVersionsTable = pgTable("resume_versions", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  label: text("label"),
  isCurrent: boolean("is_current").notNull().default(false),
  uploaderId: integer("uploader_id")
    .notNull()
    .references(() => usersTable.id),
  uploaderUsername: text("uploader_username").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export const insertResumeVersionSchema = createInsertSchema(resumeVersionsTable).omit({
  id: true,
  createdAt: true,
  isCurrent: true,
});
export type InsertResumeVersion = z.infer<typeof insertResumeVersionSchema>;
export type ResumeVersion = typeof resumeVersionsTable.$inferSelect;
