import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Statuses an appointment can be in. "cancelled" appointments free up their
// slot again but are kept around for history.
export const appointmentStatusEnum = pgEnum("booking_appointment_status", [
  "confirmed",
  "cancelled",
]);

// A single booked appointment. Double-booking is prevented at the database
// level by the unique index on `startTime` (see below) combined with an
// application-level availability check before insert.
export const appointmentsTable = pgTable("booking_appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  reason: text("reason"),
  guestName: text("guest_name").notNull(),
  guestEmail: text("guest_email").notNull(),
  // Optional link back to a signed-in user in the *host* app. The booking
  // service deliberately treats these as opaque strings rather than a
  // foreign key, since it has no knowledge of the host app's user table —
  // that's what keeps it portable across projects.
  externalUserId: text("external_user_id"),
  externalUserLabel: text("external_user_label"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull().unique(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  status: appointmentStatusEnum("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Appointment = typeof appointmentsTable.$inferSelect;
export type InsertAppointment = typeof appointmentsTable.$inferInsert;

// Which kind of automated message a notification represents. Used both to
// drive the in-app inbox and to dedupe reminder sends (a reminder is only
// ever created/sent once per appointment per kind).
export const notificationKindEnum = pgEnum("booking_notification_kind", [
  "new_booking",
  "reminder_day_before",
  "reminder_hours_before",
]);

export const notificationRecipientEnum = pgEnum("booking_notification_recipient", [
  "guest",
  "admin",
]);

// Every automated email/inbox alert sent for an appointment. Doubles as:
//  1. the in-app "inbox" feed the admin sees (recipient = 'admin' rows)
//  2. the dedupe ledger the reminder scheduler consults before sending —
//     it never sends the same (appointmentId, kind, recipient) twice.
export const notificationsTable = pgTable("booking_notifications", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id")
    .notNull()
    .references(() => appointmentsTable.id, { onDelete: "cascade" }),
  kind: notificationKindEnum("kind").notNull(),
  recipient: notificationRecipientEnum("recipient").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  emailSent: boolean("email_sent").notNull().default(false),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingNotification = typeof notificationsTable.$inferSelect;
export type InsertBookingNotification = typeof notificationsTable.$inferInsert;
