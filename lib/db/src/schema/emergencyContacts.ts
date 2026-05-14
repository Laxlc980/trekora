import { pgTable, varchar, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const emergencyContactsTable = pgTable("emergency_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  relationship: varchar("relationship", { length: 50 }).notNull(), // parent | spouse | sibling | friend | other
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_emergency_contacts_user_id").on(table.userId),
]);

export type EmergencyContact = typeof emergencyContactsTable.$inferSelect;
