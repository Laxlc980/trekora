// @ts-nocheck
import { pgTable, varchar, date, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const trekPricingSeasonsTable = pgTable("trek_pricing_seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trekId: varchar("trek_id").notNull(),
  seasonName: varchar("season_name", { length: 100 }).notNull(), // Spring, Monsoon, Autumn, Winter
  startDate: date("start_date").notNull(), // MM-DD format stored as date (year ignored)
  endDate: date("end_date").notNull(),
  priceMultiplier: numeric("price_multiplier", { precision: 4, scale: 2 }).notNull().default("1.00"),
  label: varchar("label", { length: 20 }).notNull(), // peak | shoulder | off-season
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_trek_pricing_seasons_trek_id").on(table.trekId),
]);

export type TrekPricingSeason = typeof trekPricingSeasonsTable.$inferSelect;
