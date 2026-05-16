// @ts-nocheck
import { pgTable, varchar, text, numeric, timestamp, integer, index } from "drizzle-orm/pg-core";
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
  platformFeePercent: numeric("platform_fee_percent", { precision: 5, scale: 2 }).notNull().default("5.00"),
  platformFeeAmount: numeric("platform_fee_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: varchar("status").notNull().default("paid"),
  paymentRef: varchar("payment_ref"),
  cancellationPolicy: text("cancellation_policy"),
  rating: integer("rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("IDX_bookings_trekker_id").on(table.trekkerId),
  index("IDX_bookings_trek_id").on(table.trekId),
]);

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
