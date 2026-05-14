import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  username: varchar("username", { length: 20 }).unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role"),
  agencyName: varchar("agency_name"),
  bio: varchar("bio", { length: 1000 }),
  phone: varchar("phone"),
  location: varchar("location"),
  // Verification fields
  isVerified: boolean("is_verified").notNull().default(false),
  ntbRegistrationNumber: varchar("ntb_registration_number"),
  licenseDocumentUrl: varchar("license_document_url"),
  verificationStatus: varchar("verification_status").notNull().default("unsubmitted"), // unsubmitted | pending | verified | rejected
  verificationNote: text("verification_note"),
  // Admin fields
  isBanned: boolean("is_banned").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
