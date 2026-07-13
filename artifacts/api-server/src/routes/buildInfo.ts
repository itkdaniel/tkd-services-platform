import { Router, type IRouter } from "express";
import { GetBuildInfoResponse } from "@workspace/api-zod";

// Bumped by hand on notable releases; see README "Release process".
const APP_VERSION = "0.1.0";
const BUILD_TIME = new Date().toISOString();

const router: IRouter = Router();

router.get("/build-info", (_req, res): void => {
  res.json(
    GetBuildInfoResponse.parse({
      version: APP_VERSION,
      environment: process.env.NODE_ENV ?? "development",
      buildTime: BUILD_TIME,
      commit: process.env.REPL_COMMIT ?? process.env.GIT_COMMIT ?? null,
    }),
  );
});

export default router;
