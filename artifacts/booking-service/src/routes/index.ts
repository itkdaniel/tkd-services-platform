import { Router, type IRouter } from "express";
import { requireApiKey } from "../middlewares/apiKey";
import healthRouter from "./health";
import availabilityRouter from "./availability";
import appointmentsRouter from "./appointments";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";

const router: IRouter = Router();

// Health check is intentionally unauthenticated so orchestrators/load
// balancers can probe it without a key.
router.use(healthRouter);

router.use(requireApiKey);
router.use(availabilityRouter);
router.use(appointmentsRouter);
router.use(notificationsRouter);
router.use(adminRouter);

export default router;
