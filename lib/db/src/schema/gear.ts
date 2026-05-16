// @ts-nocheck
import { pgTable, varchar, text, numeric, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const gearRentalsTable = pgTable("gear_rentals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: varchar("agency_id").notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  description: text("description"),
  pricePerDay: numeric("price_per_day", { precision: 10, scale: 2 }).notNull(),
  depositAmount: numeric("deposit_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  available: boolean("available").notNull().default(true),
  imageUrl: varchar("image_url"),
  category: varchar("category", { length: 50 }).notNull(), // footwear | clothing | camping | safety | navigation
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_gear_rentals_agency_id").on(table.agencyId),
  index("IDX_gear_rentals_category").on(table.category),
]);

export const secondhandGearTable = pgTable("secondhand_gear", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priceNPR: numeric("price_npr", { precision: 10, scale: 2 }).notNull(),
  condition: varchar("condition", { length: 20 }).notNull(), // like_new | good | fair
  imageUrl: varchar("image_url"),
  category: varchar("category", { length: 50 }).notNull(),
  sold: boolean("sold").notNull().default(false),
  location: varchar("location", { length: 255 }),
  contactPreference: varchar("contact_preference", { length: 10 }).notNull().default("dm"), // dm | phone | both
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_secondhand_gear_seller_id").on(table.sellerId),
  index("IDX_secondhand_gear_category").on(table.category),
]);

export type GearRental = typeof gearRentalsTable.$inferSelect;
export type SecondhandGear = typeof secondhandGearTable.$inferSelect;
