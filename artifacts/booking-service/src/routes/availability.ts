import { Router, type IRouter } from "express";
import { z } from "zod";
import { getAvailability } from "../lib/availability";
import { config } from "../lib/config";

const router: IRouter = Router();

const QuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

router.get("/availability", async (req, res): Promise<void> => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { from, to } = parsed.data;
  if (to <= from) {
    res.status(400).json({ error: "`to` must be after `from`" });
    return;
  }
  const maxRangeMs = config.maxBookingHorizonDays * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxRangeMs) {
    res.status(400).json({ error: `Range too large; max ${config.maxBookingHorizonDays} days` });
    return;
  }

  const slots = await getAvailability(from, to);
  res.json({ slots });
});

export default router;
