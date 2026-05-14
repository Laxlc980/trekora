import { pgTable, varchar, text, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const reviewsTable = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull(),
  trekId: varchar("trek_id").notNull(),
  agencyId: varchar("agency_id").notNull(),
  trekkerId: varchar("trekker_id").notNull(),
  rating: integer("rating").notNull(), // 1-5
  title: varchar("title", { length: 100 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("UQ_reviews_booking_id").on(table.bookingId),
  index("IDX_reviews_trek_id").on(table.trekId),
  index("IDX_reviews_agency_id").on(table.agencyId),
  index("IDX_reviews_trekker_id").on(table.trekkerId),
]);

export type Review = typeof reviewsTable.$inferSelect;
