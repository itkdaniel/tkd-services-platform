import { Router, type IRouter } from "express";
import { z } from "zod";
import { getAvailability } from "../lib/availability";
import { getBookingSettings } from "../lib/settingsStore";

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
  const settings = await getBookingSettings();
  const maxRangeMs = settings.maxBookingHorizonDays * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxRangeMs) {
    res.status(400).json({ error: `Range too large; max ${settings.maxBookingHorizonDays} days` });
    return;
  }

  const slots = await getAvailability(from, to);
  res.json({ slots });
});

export default router;
