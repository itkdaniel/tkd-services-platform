import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Universal "feature database" (table) definition — the factory entrypoint.
// Every table shares these universal fields regardless of domain, so new
// feature databases can always be related to one another in the knowledge graph.
export const featureTablesTable = pgTable("feature_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  category: text("category").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFeatureTableSchema = createInsertSchema(featureTablesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFeatureTable = z.infer<typeof insertFeatureTableSchema>;
export type FeatureTable = typeof featureTablesTable.$inferSelect;
