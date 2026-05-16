// @ts-nocheck
import { pgTable, varchar, numeric, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sosAlertsTable = pgTable("sos_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  bookingId: varchar("booking_id").notNull(),
  trekName: varchar("trek_name", { length: 255 }).notNull(),
  agencyName: varchar("agency_name", { length: 255 }),
  agencyPhone: varchar("agency_phone", { length: 50 }),
  lastKnownDestination: varchar("last_known_destination", { length: 255 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("IDX_sos_alerts_user_id").on(table.userId),
]);

export type SosAlert = typeof sosAlertsTable.$inferSelect;
