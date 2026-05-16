// @ts-nocheck
import { pgTable, varchar, text, numeric, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bidsTable = pgTable("bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customRequestId: varchar("custom_request_id").notNull(),
  agencyId: varchar("agency_id").notNull(),
  proposedPrice: numeric("proposed_price", { precision: 10, scale: 2 }).notNull(),
  planDescription: text("plan_description").notNull(),
  message: text("message"),
  status: varchar("status").notNull().default("pending"),
  rejectionMessage: text("rejection_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("IDX_bids_custom_request_id").on(table.customRequestId),
  index("IDX_bids_agency_id").on(table.agencyId),
]);

export const insertBidSchema = createInsertSchema(bidsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bidsTable.$inferSelect;
