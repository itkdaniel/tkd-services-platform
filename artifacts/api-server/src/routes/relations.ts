import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, entityRelationsTable, featureEntriesTable } from "@workspace/db";
import {
  CreateRelationBody,
  CreateRelationResponse,
  ListRelationsResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { cacheInvalidate } from "../lib/cache";
import { toPlain } from "../lib/serialize";

const router: IRouter = Router();

router.get("/relations", async (_req, res): Promise<void> => {
  const relations = await db.select().from(entityRelationsTable).orderBy(entityRelationsTable.createdAt);
  res.json(ListRelationsResponse.parse(toPlain(relations)));
});

router.post("/relations", requireRole("admin", "user"), async (req, res): Promise<void> => {
  const parsed = CreateRelationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.fromEntryId === parsed.data.toEntryId) {
    res.status(400).json({ error: "An entry cannot relate to itself" });
    return;
  }

  const entries = await db
    .select({ id: featureEntriesTable.id })
    .from(featureEntriesTable)
    .where(inArray(featureEntriesTable.id, [parsed.data.fromEntryId, parsed.data.toEntryId]));
  if (entries.length < 2) {
    res.status(404).json({ error: "One or both entries were not found" });
    return;
  }

  const [relation] = await db
    .insert(entityRelationsTable)
    .values({
      fromEntryId: parsed.data.fromEntryId,
      toEntryId: parsed.data.toEntryId,
      relationType: parsed.data.relationType,
      weight: parsed.data.weight ?? null,
      justification: parsed.data.justification ?? null,
    })
    .returning();

  if (!relation) {
    req.log.error("Insert returned no row for new relation");
    res.status(500).json({ error: "Failed to create relation" });
    return;
  }

  cacheInvalidate("graph:");
  res.status(201).json(CreateRelationResponse.parse(toPlain(relation)));
});

export default router;
