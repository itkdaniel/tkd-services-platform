import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { featureTablesTable } from "./featureTables";

// A single data record (graph node). Universal fields (id, tableId, label,
// timestamps) are shared by every entry regardless of domain; anything
// domain-specific lives in `data` so new fields never require a migration.
export const featureEntriesTable = pgTable("feature_entries", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id")
    .notNull()
    .references(() => featureTablesTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertFeatureEntrySchema = createInsertSchema(featureEntriesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFeatureEntry = z.infer<typeof insertFeatureEntrySchema>;
export type FeatureEntry = typeof featureEntriesTable.$inferSelect;
