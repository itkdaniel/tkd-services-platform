/**
 * Settings store — reads booking configuration from the DB (booking_settings
 * singleton row) and falls back to env-var driven defaults from `config` when
 * no row exists yet. Results are cached for 30 seconds so availability queries
 * are fast while still picking up admin changes promptly.
 */
import { db } from "../db";
import { settingsTable } from "../db/schema";
import { config } from "./config";

export interface ResolvedSettings {
  businessDays: number[];
  businessStartHour: number;
  businessEndHour: number;
  businessStartMinutes: number;
  businessEndMinutes: number;
  slotDurationMinutes: number;
  maxBookingHorizonDays: number;
  businessUtcOffsetMinutes: number;
}

let cache: ResolvedSettings | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

/** Evict the in-process cache — called immediately after a settings write. */
export function invalidateSettingsCache(): void {
  cache = null;
  cacheExpiresAt = 0;
}

/**
 * Build resolved settings from env-var config. Used as the fallback when the
 * DB is unavailable or the settings table doesn't exist yet.
 */
function resolveFromEnv(): ResolvedSettings {
  return {
    businessDays: config.businessDays,
    businessStartHour: config.businessStartMinutes / 60,
    businessEndHour: config.businessEndMinutes / 60,
    businessStartMinutes: config.businessStartMinutes,
    businessEndMinutes: config.businessEndMinutes,
    slotDurationMinutes: config.slotDurationMinutes,
    maxBookingHorizonDays: config.maxBookingHorizonDays,
    businessUtcOffsetMinutes: config.businessUtcOffsetMinutes,
  };
}

/** Returns DB-backed settings, falling back to env-var defaults. */
export async function getBookingSettings(): Promise<ResolvedSettings> {
  const now = Date.now();
  if (cache && now < cacheExpiresAt) {
    return cache;
  }

  let row: typeof settingsTable.$inferSelect | undefined;
  try {
    [row] = await db.select().from(settingsTable).limit(1);
  } catch (err) {
    // If the table doesn't exist yet (e.g. migration hasn't run or failed),
    // return env-var defaults so booking endpoints stay functional.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("relation") && msg.includes("does not exist")) {
      return resolveFromEnv();
    }
    throw err;
  }

  let resolved: ResolvedSettings;
  if (row) {
    const days = row.businessDays
      .split(",")
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => Number.isFinite(d));
    resolved = {
      businessDays: days,
      businessStartHour: row.businessStartHour,
      businessEndHour: row.businessEndHour,
      businessStartMinutes: row.businessStartHour * 60,
      businessEndMinutes: row.businessEndHour * 60,
      slotDurationMinutes: row.slotDurationMinutes,
      maxBookingHorizonDays: row.maxBookingHorizonDays,
      businessUtcOffsetMinutes: config.businessUtcOffsetMinutes,
    };
  } else {
    // No row yet — fall back to env-var values.
    resolved = resolveFromEnv();
  }

  cache = resolved;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return resolved;
}
