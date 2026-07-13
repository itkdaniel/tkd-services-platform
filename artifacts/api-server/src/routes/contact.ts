import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, contactMessagesTable } from "@workspace/db";
import {
  CreateContactMessageBody,
  CreateContactMessageResponse,
  ListContactMessagesResponse,
} from "@workspace/api-zod";
import { requireRole } from "../middlewares/auth";
import { toPlain } from "../lib/serialize";

const router: IRouter = Router();

router.get("/contact-messages", requireRole("admin"), async (_req, res): Promise<void> => {
  const messages = await db
    .select()
    .from(contactMessagesTable)
    .orderBy(desc(contactMessagesTable.createdAt));
  res.json(ListContactMessagesResponse.parse(toPlain(messages)));
});

router.post("/contact-messages", async (req, res): Promise<void> => {
  const parsed = CreateContactMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [message] = await db
    .insert(contactMessagesTable)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message,
    })
    .returning();

  if (!message) {
    req.log.error("Insert returned no row for new contact message");
    res.status(500).json({ error: "Failed to submit message" });
    return;
  }

  res.status(201).json(CreateContactMessageResponse.parse(toPlain(message)));
});

export default router;
