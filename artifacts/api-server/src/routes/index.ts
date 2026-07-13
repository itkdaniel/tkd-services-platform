import { Router, type IRouter } from "express";
import healthRouter from "./health";
import buildInfoRouter from "./buildInfo";
import authRouter from "./auth";
import tablesRouter from "./tables";
import fieldsRouter from "./fields";
import entriesRouter from "./entries";
import relationsRouter from "./relations";
import graphRouter from "./graph";
import blogRouter from "./blog";
import contactRouter from "./contact";
import storageRouter from "./storage";
import resumeRouter from "./resume";

const router: IRouter = Router();

router.use(healthRouter);
router.use(buildInfoRouter);
router.use(authRouter);
router.use(tablesRouter);
router.use(fieldsRouter);
router.use(entriesRouter);
router.use(relationsRouter);
router.use(graphRouter);
router.use(blogRouter);
router.use(contactRouter);
router.use(storageRouter);
router.use(resumeRouter);

export default router;
