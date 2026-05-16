// @ts-nocheck
import { pgTable, varchar, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const permitTypesTable = pgTable("permit_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  destination: varchar("destination", { length: 255 }).notNull(),
  permitName: varchar("permit_name", { length: 255 }).notNull(),
  description: text("description"),
  priceNPR: integer("price_npr").notNull(),
  priceUSD: integer("price_usd").notNull(),
  issuingAuthority: varchar("issuing_authority", { length: 255 }).notNull(),
  documentUrl: varchar("document_url"),
  validityDays: integer("validity_days").notNull().default(30),
  required: boolean("required").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_permit_types_destination").on(table.destination),
]);

export const userPermitsTable = pgTable("user_permits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  permitTypeId: varchar("permit_type_id").notNull(),
  bookingId: varchar("booking_id"),
  status: varchar("status").notNull().default("pending_payment"), // pending_payment | paid | issued | cancelled | offline_pending
  paymentMethod: varchar("payment_method"), // khalti | esewa | stripe | offline
  transactionId: varchar("transaction_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  permitNumber: varchar("permit_number"),
  permitFileUrl: varchar("permit_file_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_user_permits_user_id").on(table.userId),
  index("IDX_user_permits_permit_type_id").on(table.permitTypeId),
]);

export type PermitType = typeof permitTypesTable.$inferSelect;
export type UserPermit = typeof userPermitsTable.$inferSelect;
