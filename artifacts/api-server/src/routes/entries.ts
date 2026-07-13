import { Router, type IRouter } from "express";
import { and, eq, or } from "drizzle-orm";
import {
  db,
  entityRelationsTable,
  featureEntriesTable,
  featureTablesTable,
} from "@workspace/db";
import {
  CreateEntryBody,
  CreateEntryParams,
  CreateEntryResponse,
  DeleteEntryParams,
  GetEntryParams,
  GetEntryResponse,
  ListEntriesParams,
  ListEntriesResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { cacheInvalidate } from "../lib/cache";
import { toPlain } from "../lib/serialize";

const router: IRouter = Router();

router.get("/tables/:tableId/entries", async (req, res): Promise<void> => {
  const params = ListEntriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const entries = await db
    .select()
    .from(featureEntriesTable)
    .where(eq(featureEntriesTable.tableId, params.data.tableId))
    .orderBy(featureEntriesTable.createdAt);

  res.json(ListEntriesResponse.parse(toPlain(entries)));
});

router.post("/tables/:tableId/entries", requireRole("admin", "user"), async (req, res): Promise<void> => {
  const params = CreateEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CreateEntryBody.safeParse(req.body);
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

  const [entry] = await db
    .insert(featureEntriesTable)
    .values({
      tableId: params.data.tableId,
      label: body.data.label,
      data: body.data.data,
    })
    .returning();

  if (!entry) {
    req.log.error("Insert returned no row for new entry");
    res.status(500).json({ error: "Failed to create entry" });
    return;
  }

  cacheInvalidate("graph:");
  res.status(201).json(CreateEntryResponse.parse(toPlain(entry)));
});

router.get("/entries/:entryId", async (req, res): Promise<void> => {
  const params = GetEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db
    .select()
    .from(featureEntriesTable)
    .where(eq(featureEntriesTable.id, params.data.entryId));
  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  const [table] = await db
    .select()
    .from(featureTablesTable)
    .where(eq(featureTablesTable.id, entry.tableId));
  if (!table) {
    req.log.error({ entryId: entry.id }, "Entry references a missing table");
    res.status(404).json({ error: "Entry's table no longer exists" });
    return;
  }

  const [outgoing, incoming] = await Promise.all([
    db.select().from(entityRelationsTable).where(eq(entityRelationsTable.fromEntryId, entry.id)),
    db.select().from(entityRelationsTable).where(eq(entityRelationsTable.toEntryId, entry.id)),
  ]);

  res.json(GetEntryResponse.parse(toPlain({ entry, table, outgoing, incoming })));
});

router.delete("/entries/:entryId", requireRole("admin", "user"), async (req, res): Promise<void> => {
  const params = DeleteEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Relations reference entries with onDelete cascade, but clean up
  // explicitly too so behavior doesn't silently depend on DB cascade config.
  await db
    .delete(entityRelationsTable)
    .where(
      or(
        eq(entityRelationsTable.fromEntryId, params.data.entryId),
        eq(entityRelationsTable.toEntryId, params.data.entryId),
      ),
    );

  const [entry] = await db
    .delete(featureEntriesTable)
    .where(eq(featureEntriesTable.id, params.data.entryId))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }

  cacheInvalidate("graph:");
  res.sendStatus(204);
});

export default router;
