import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, featureFieldsTable, featureTablesTable } from "@workspace/db";
import {
  CreateFieldBody,
  CreateFieldParams,
  CreateFieldResponse,
  ListFieldsParams,
  ListFieldsResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { toPlain } from "../lib/serialize";

const router: IRouter = Router();

router.get("/tables/:tableId/fields", async (req, res): Promise<void> => {
  const params = ListFieldsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const fields = await db
    .select()
    .from(featureFieldsTable)
    .where(eq(featureFieldsTable.tableId, params.data.tableId))
    .orderBy(featureFieldsTable.createdAt);

  res.json(ListFieldsResponse.parse(toPlain(fields)));
});

// Adds a new field to an existing feature database — this is how a table's
// schema grows over time without ever needing a manual migration.
router.post("/tables/:tableId/fields", requireRole("admin", "user"), async (req, res): Promise<void> => {
  const params = CreateFieldParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CreateFieldBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [table] = await db
    .select({ id: featureTablesTable.id })
    .from(featureTablesTable)
    .where(eq(featureTablesTable.id, params.data.tableId));
  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  const [field] = await db
    .insert(featureFieldsTable)
    .values({
      tableId: params.data.tableId,
      name: body.data.name,
      dataType: body.data.dataType,
      description: body.data.description ?? null,
      required: body.data.required ?? false,
    })
    .returning();

  if (!field) {
    req.log.error("Insert returned no row for new field");
    res.status(500).json({ error: "Failed to create field" });
    return;
  }

  res.status(201).json(CreateFieldResponse.parse(toPlain(field)));
});

export default router;
