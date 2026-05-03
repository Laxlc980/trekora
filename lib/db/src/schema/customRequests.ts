import { pgTable, varchar, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customRequestsTable = pgTable("custom_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trekkerId: varchar("trekker_id").notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  budget: numeric("budget", { precision: 10, scale: 2 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  groupSize: integer("group_size").notNull().default(1),
  notes: text("notes"),
  status: varchar("status").notNull().default("open"),
  selectedBidId: varchar("selected_bid_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCustomRequestSchema = createInsertSchema(customRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomRequest = z.infer<typeof insertCustomRequestSchema>;
export type CustomRequest = typeof customRequestsTable.$inferSelect;
