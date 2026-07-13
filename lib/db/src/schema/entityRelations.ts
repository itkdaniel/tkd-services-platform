import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { featureEntriesTable } from "./featureEntries";

// Directed, weighted, justified edges between entries — the knowledge graph.
// `weight` doubles as a probability/confidence score (0-1) and `justification`
// records why the relation was drawn, so the graph stays explainable as it grows.
export const entityRelationsTable = pgTable("entity_relations", {
  id: serial("id").primaryKey(),
  fromEntryId: integer("from_entry_id")
    .notNull()
    .references(() => featureEntriesTable.id, { onDelete: "cascade" }),
  toEntryId: integer("to_entry_id")
    .notNull()
    .references(() => featureEntriesTable.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull(),
  weight: real("weight"),
  justification: text("justification"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEntityRelationSchema = createInsertSchema(entityRelationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEntityRelation = z.infer<typeof insertEntityRelationSchema>;
export type EntityRelation = typeof entityRelationsTable.$inferSelect;
