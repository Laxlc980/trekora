import { pgTable, varchar, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trekkerId: varchar("trekker_id").notNull(),
  trekId: varchar("trek_id"),
  bidId: varchar("bid_id"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  advanceAmount: numeric("advance_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default("paid"),
  paymentRef: varchar("payment_ref"),
  cancellationPolicy: text("cancellation_policy"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
