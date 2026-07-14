// Central place for every env-driven config knob. Keeping this in one file
// is what makes the service "config-driven, not code-driven" for the things
// the plan calls out explicitly: business hours/slot size and the email
// provider selection.

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  port: envInt("PORT", 8000),

  // Shared-secret header the caller (the host app's API server) must send
  // on every request. This is what lets the service sit on an internal
  // port with no public exposure of its own.
  apiKey: process.env.BOOKING_SERVICE_API_KEY ?? "",

  // Business hours are expressed in a fixed UTC offset (minutes) rather
  // than an IANA timezone, trading full DST-awareness for a dependency-free
  // implementation. Override BUSINESS_UTC_OFFSET_MINUTES per deployment.
  businessUtcOffsetMinutes: envInt("BUSINESS_UTC_OFFSET_MINUTES", 0),
  businessDays: (process.env.BUSINESS_DAYS ?? "1,2,3,4,5")
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => Number.isFinite(d)),
  businessStartMinutes: envInt("BUSINESS_START_HOUR", 9) * 60,
  businessEndMinutes: envInt("BUSINESS_END_HOUR", 17) * 60,
  slotDurationMinutes: envInt("SLOT_DURATION_MINUTES", 30),
  maxBookingHorizonDays: envInt("MAX_BOOKING_HORIZON_DAYS", 60),

  // The party that receives every booking notification/reminder alongside
  // the guest. The service has no concept of the host app's own user
  // table, so this is the only way it knows who the "admin" is.
  adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
  adminLabel: process.env.ADMIN_NOTIFICATION_LABEL ?? "Admin",

  // Email provider selection: "gmail" (default, via the Replit Gmail
  // connector) or "smtp" (nodemailer, for ProtonMail/Tutanota/any SMTP
  // provider). Swapping providers never requires touching booking logic.
  emailProvider: (process.env.EMAIL_PROVIDER ?? "gmail").toLowerCase(),
  emailFrom: process.env.EMAIL_FROM ?? "",

  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: envInt("SMTP_PORT", 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
  },

  // How often the reminder scheduler checks for due reminders.
  reminderCheckCron: process.env.REMINDER_CHECK_CRON ?? "*/15 * * * *",
};
