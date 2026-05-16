// @ts-nocheck
import { pgTable, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const discussionThreadsTable = pgTable("discussion_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  authorId: varchar("author_id").notNull(),
  authorName: varchar("author_name"),
  authorRole: varchar("author_role"),
  replyCount: integer("reply_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const threadRepliesTable = pgTable("thread_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull(),
  body: text("body").notNull(),
  authorId: varchar("author_id").notNull(),
  authorName: varchar("author_name"),
  authorRole: varchar("author_role"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DiscussionThread = typeof discussionThreadsTable.$inferSelect;
export type ThreadReply = typeof threadRepliesTable.$inferSelect;
