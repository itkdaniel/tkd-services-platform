/**
 * Lightweight startup migration — creates any tables that don't exist yet so
 * the service can start cleanly on a fresh DB or after being upgraded to a
 * version that adds new tables.
 *
 * We intentionally avoid drizzle-kit push/migrate here because it requires TTY
 * interaction when untracked tables are present (see project memory note on
 * drizzle-push-interactive-prompt). Raw SQL is the safest path for additive
 * migrations in this service.
 */
import { pool } from "./index";
import { logger } from "../lib/logger";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // Enums — created idempotently via DO blocks so re-running on an
    // existing DB is always safe.
    await client.query(`
      DO $ BEGIN
        CREATE TYPE booking_appointment_status AS ENUM ('confirmed','cancelled');
      EXCEPTION WHEN duplicate_object THEN NULL; END $;

      DO $ BEGIN
        CREATE TYPE booking_notification_kind AS ENUM (
          'new_booking','reminder_day_before','reminder_hours_before'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $;

      DO $ BEGIN
        CREATE TYPE booking_notification_recipient AS ENUM ('guest','admin');
      EXCEPTION WHEN duplicate_object THEN NULL; END $;
    `);

    // Core appointments table.
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_appointments (
        id                  SERIAL PRIMARY KEY,
        title               TEXT NOT NULL,
        reason              TEXT,
        guest_name          TEXT NOT NULL,
        guest_email         TEXT NOT NULL,
        external_user_id    TEXT,
        external_user_label TEXT,
        start_time          TIMESTAMPTZ NOT NULL UNIQUE,
        end_time            TIMESTAMPTZ NOT NULL,
        status              booking_appointment_status NOT NULL DEFAULT 'confirmed',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Notifications / inbox ledger — also dedupes reminder sends.
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_notifications (
        id             SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL
          REFERENCES booking_appointments(id) ON DELETE CASCADE,
        kind           booking_notification_kind NOT NULL,
        recipient      booking_notification_recipient NOT NULL,
        subject        TEXT NOT NULL,
        message        TEXT NOT NULL,
        email_sent     BOOLEAN NOT NULL DEFAULT false,
        read           BOOLEAN NOT NULL DEFAULT false,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // booking_settings — singleton row that overrides env-var booking config.
    // Added in v2 of the booking service; safe to run on existing DBs.
    await client.query(`
      CREATE TABLE IF NOT EXISTS booking_settings (
        id                       INTEGER PRIMARY KEY DEFAULT 1,
        business_days            TEXT    NOT NULL DEFAULT '1,2,3,4,5',
        business_start_hour      INTEGER NOT NULL DEFAULT 9,
        business_end_hour        INTEGER NOT NULL DEFAULT 17,
        slot_duration_minutes    INTEGER NOT NULL DEFAULT 30,
        max_booking_horizon_days INTEGER NOT NULL DEFAULT 60,
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    logger.info("DB migrations applied");
  } catch (err) {
    logger.error({ err }, "DB migration failed — service may be degraded");
    // Do not throw: let the service start; the settings fallback path will
    // use env-var defaults if the table is unavailable.
  } finally {
    client.release();
  }
}
