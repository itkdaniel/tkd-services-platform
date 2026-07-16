import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachUser } from "./middlewares/auth";

const app: Express = express();

// Trust exactly one proxy hop (Replit's reverse proxy).  This lets Express
// set req.ip to the real client IP from the X-Forwarded-For header added by
// the trusted proxy, while ignoring any XFF values injected further left by
// the client itself.  Without this, all requests appear to come from the
// proxy's loopback address; with it, a client cannot spoof req.ip by
// prepending arbitrary IPs to the header.
app.set("trust proxy", 1);

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set. Did you forget to provision it?");
}

const PgSession = connectPgSimple(session);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    // The "sessions" table is created out-of-band (see README) rather than via
    // createTableIfMissing: that option reads a bundled .sql file from disk at
    // runtime, which esbuild's single-file bundle output doesn't include.
    store: new PgSession({ pool, tableName: "sessions", createTableIfMissing: false }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }),
);
app.use(attachUser);

app.use("/api", router);

export default app;
