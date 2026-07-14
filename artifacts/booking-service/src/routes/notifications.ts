import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { notificationsTable } from "../db/schema";

const router: IRouter = Router();

const ListQuerySchema = z.object({
  recipient: z.enum(["guest", "admin"]).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

router.get("/notifications", async (req, res): Promise<void> => {
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.recipient) conditions.push(eq(notificationsTable.recipient, parsed.data.recipient));
  if (parsed.data.unreadOnly) conditions.push(eq(notificationsTable.read, false));

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(notificationsTable.createdAt));

  res.json(rows.map(serialize));
});

const ParamsSchema = z.object({ id: z.coerce.number().int() });

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const params = ParamsSchema.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(serialize(row));
});

function serialize(row: typeof notificationsTable.$inferSelect) {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    kind: row.kind,
    recipient: row.recipient,
    subject: row.subject,
    message: row.message,
    emailSent: row.emailSent,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export default router;
