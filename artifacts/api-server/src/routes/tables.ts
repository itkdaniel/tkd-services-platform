import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, featureTablesTable } from "@workspace/db";
import {
  CreateTableBody,
  CreateTableResponse,
  DeleteTableParams,
  GetTableParams,
  GetTableResponse,
  ListTablesResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { cacheInvalidate } from "../lib/cache";
import { toPlain } from "../lib/serialize";

const router: IRouter = Router();

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length > 0 ? base : `table-${Date.now()}`;
}

router.get("/tables", async (_req, res): Promise<void> => {
  const tables = await db.select().from(featureTablesTable).orderBy(featureTablesTable.createdAt);
  res.json(ListTablesResponse.parse(toPlain(tables)));
});

router.post("/tables", requireRole("admin", "user"), async (req, res): Promise<void> => {
  const parsed = CreateTableBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const slugBase = slugify(parsed.data.name);
  let slug = slugBase;
  let attempt = 1;
  // Factory-style creation: keep the requested name but guarantee a unique
  // slug so tables never silently collide when "the same" name is reused.
  while (true) {
    const existing = await db
      .select({ id: featureTablesTable.id })
      .from(featureTablesTable)
      .where(eq(featureTablesTable.slug, slug));
    if (existing.length === 0) break;
    attempt += 1;
    slug = `${slugBase}-${attempt}`;
  }

  const [table] = await db
    .insert(featureTablesTable)
    .values({
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      createdBy: req.currentUser?.username ?? null,
    })
    .returning();

  if (!table) {
    req.log.error("Insert returned no row for new table");
    res.status(500).json({ error: "Failed to create table" });
    return;
  }

  cacheInvalidate("graph:");
  res.status(201).json(CreateTableResponse.parse(toPlain(table)));
});

router.get("/tables/:tableId", async (req, res): Promise<void> => {
  const params = GetTableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [table] = await db
    .select()
    .from(featureTablesTable)
    .where(eq(featureTablesTable.id, params.data.tableId));

  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  res.json(GetTableResponse.parse(toPlain(table)));
});

router.delete("/tables/:tableId", requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteTableParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [table] = await db
    .delete(featureTablesTable)
    .where(eq(featureTablesTable.id, params.data.tableId))
    .returning();

  if (!table) {
    res.status(404).json({ error: "Table not found" });
    return;
  }

  cacheInvalidate("graph:");
  res.sendStatus(204);
});

export default router;
