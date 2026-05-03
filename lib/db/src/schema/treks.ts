import { pgTable, varchar, text, integer, numeric, date, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const treksTable = pgTable("treks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agencyId: varchar("agency_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  duration: integer("duration").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  maxGroupSize: integer("max_group_size").notNull(),
  description: text("description").notNull(),
  imageUrl: varchar("image_url"),
  status: varchar("status").notNull().default("active"),
  currentParticipants: integer("current_participants").notNull().default(0),
  difficultyLevel: varchar("difficulty_level").notNull().default("moderate"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTrekSchema = createInsertSchema(treksTable).omit({ id: true, currentParticipants: true, createdAt: true, updatedAt: true });
export type InsertTrek = z.infer<typeof insertTrekSchema>;
export type Trek = typeof treksTable.$inferSelect;
