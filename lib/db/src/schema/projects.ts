import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// "none": no demo configured yet.
// "external": demoUrl points at a third-party live link, shown embedded in an iframe.
// "subapp": an uploaded archive was extracted into object storage and is served
//   from this API under /projects/:projectId/subapp/*, shown embedded in an iframe.
export const projectDemoTypeEnum = pgEnum("project_demo_type", ["none", "external", "subapp"]);

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  thumbnailObjectPath: text("thumbnail_object_path"),
  githubUrl: text("github_url"),
  demoType: projectDemoTypeEnum("demo_type").notNull().default("none"),
  demoUrl: text("demo_url"),
  // Object storage prefix (e.g. "subapps/<uuid>") holding the extracted
  // sub-app bundle for this project. Namespaced per project so one upload
  // can never read or overwrite another project's files.
  subappObjectPrefix: text("subapp_object_prefix"),
  subappEntrypoint: text("subapp_entrypoint").default("index.html"),
  // Free-form tags for filtering (e.g. "React", "backend"). Stored as a
  // postgres text array; defaults to an empty array for existing rows.
  tags: text("tags").array().notNull().default([]),
  // Lower values sort first. Defaults to 0 for newly-created rows; the API
  // assigns new projects a value one higher than the current max so they
  // land at the end of the admin-defined order rather than jumping to the front.
  sortOrder: integer("sort_order").notNull().default(0),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => usersTable.id),
  ownerUsername: text("owner_username").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
