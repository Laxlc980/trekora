import { pgTable, varchar, text, integer, numeric, boolean, date, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const teahousesTable = pgTable("teahouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  altitude: integer("altitude"), // meters
  destination: varchar("destination", { length: 255 }).notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  facilities: text("facilities"), // JSON array stored as text
  priceRange: varchar("price_range", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_teahouses_destination").on(table.destination),
]);

export const checkinsTable = pgTable("checkins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  teahouseId: varchar("teahouse_id").notNull(),
  checkinDate: date("checkin_date").notNull(),
  note: text("note"),
  trailCondition: varchar("trail_condition", { length: 20 }).notNull().default("clear"), // clear | muddy | snowy | landslide | closed
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_checkins_user_id").on(table.userId),
  index("IDX_checkins_teahouse_id").on(table.teahouseId),
]);

export type Teahouse = typeof teahousesTable.$inferSelect;
export type Checkin = typeof checkinsTable.$inferSelect;
