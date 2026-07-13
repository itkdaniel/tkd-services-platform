import { Router, type IRouter } from "express";
import { and, eq, ilike } from "drizzle-orm";
import {
  db,
  entityRelationsTable,
  featureEntriesTable,
  featureTablesTable,
} from "@workspace/db";
import { GetGraphQueryParams, GetGraphResponse } from "@workspace/api-zod";
import { cacheGet, cacheSet } from "../lib/cache";

const router: IRouter = Router();

router.get("/graph", async (req, res): Promise<void> => {
  const query = GetGraphQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { search, tableId, limit } = query.data;

  const cacheKey = `graph:${search ?? ""}:${tableId ?? ""}:${limit}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Feature tables double as the graph's clustering key: every node is
  // colored/grouped by its table's category on the frontend.
  const tables = await db.select().from(featureTablesTable);
  const tableById = new Map(tables.map((t) => [t.id, t]));

  const filters = [];
  if (search) filters.push(ilike(featureEntriesTable.label, `%${search}%`));
  if (tableId !== undefined) filters.push(eq(featureEntriesTable.tableId, tableId));

  const entries = await (filters.length > 0
    ? db
        .select()
        .from(featureEntriesTable)
        .where(and(...filters))
        .limit(limit)
    : db.select().from(featureEntriesTable).limit(limit));

  const entryIds = new Set(entries.map((e) => e.id));

  const nodes = entries
    .map((entry) => {
      const table = tableById.get(entry.tableId);
      if (!table) return null;
      return {
        id: entry.id,
        label: entry.label,
        tableId: table.id,
        tableName: table.name,
        category: table.category,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  const allRelations = await db.select().from(entityRelationsTable);
  const edges = allRelations
    .filter((r) => entryIds.has(r.fromEntryId) && entryIds.has(r.toEntryId))
    .map((r) => ({
      id: r.id,
      source: r.fromEntryId,
      target: r.toEntryId,
      relationType: r.relationType,
      weight: r.weight,
      justification: r.justification,
    }));

  const payload = GetGraphResponse.parse({ nodes, edges });
  cacheSet(cacheKey, payload, 15_000);
  res.json(payload);
});

export default router;
