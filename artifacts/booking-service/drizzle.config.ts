import { defineConfig } from "drizzle-kit";
import path from "path";

// The booking service intentionally owns its own database connection and
// migrations, separate from the main app's `@workspace/db` package. This is
// what makes it a portable, standalone service: dropped into another
// project, it only needs its own BOOKING_DATABASE_URL to provision its
// tables, with no dependency on the host app's schema. In this workspace it
// happens to point at the same Postgres instance as the main app (there is
// only one provisioned), but its tables live under distinct `booking_*`
// names so the two schemas never collide.
const databaseUrl = process.env.BOOKING_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("BOOKING_DATABASE_URL (or DATABASE_URL) must be set, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/db/schema.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
