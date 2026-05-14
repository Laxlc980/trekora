import { pgTable, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const dmRequestsTable = pgTable("dm_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull(),
  toUserId: varchar("to_user_id").notNull(),
  status: varchar("status").notNull().default("pending"), // pending | accepted | rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_dm_requests_from_user_id").on(table.fromUserId),
  index("IDX_dm_requests_to_user_id").on(table.toUserId),
]);

export const dmMessagesTable = pgTable("dm_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // conversationId is the canonical pair key: smaller userId + "_" + larger userId
  conversationId: varchar("conversation_id").notNull(),
  senderId: varchar("sender_id").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("IDX_dm_messages_conversation_id").on(table.conversationId),
  index("IDX_dm_messages_sender_id").on(table.senderId),
]);

export type DmRequest = typeof dmRequestsTable.$inferSelect;
export type DmMessage = typeof dmMessagesTable.$inferSelect;
