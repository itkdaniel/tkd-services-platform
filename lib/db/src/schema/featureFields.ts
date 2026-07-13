import { boolean, integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { featureTablesTable } from "./featureTables";

// Dynamic field definitions let a table's schema grow after creation
// (add new fields to an existing feature database without a migration).
export const fieldDataTypeEnum = pgEnum("field_data_type", [
  "string",
  "number",
  "boolean",
  "date",
  "json",
]);

export const featureFieldsTable = pgTable("feature_fields", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id")
    .notNull()
    .references(() => featureTablesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dataType: fieldDataTypeEnum("data_type").notNull(),
  description: text("description"),
  required: boolean("required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFeatureFieldSchema = createInsertSchema(featureFieldsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFeatureField = z.infer<typeof insertFeatureFieldSchema>;
export type FeatureField = typeof featureFieldsTable.$inferSelect;
