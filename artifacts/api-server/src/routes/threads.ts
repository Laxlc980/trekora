import { Router, type IRouter, type Request, type Response } from "express";
import { db, discussionThreadsTable, threadRepliesTable, usersTable } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";

const router: IRouter = Router();

function parsePagination(query: Record<string, unknown>): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function displayName(u: { username: string | null; firstName: string | null; lastName: string | null; email: string | null; agencyName: string | null } | undefined, role: string | null | undefined) {
  if (!u) return null;
  // Username is the canonical public identity — never fall back to email
  if (u.username) return `@${u.username}`;
  if (role === "agency" && u.agencyName) return u.agencyName;
  const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return fullName || null;
}

router.get("/threads", async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePagination(req.query);

  const [{ total }] = await db
    .select({ total: count() })
    .from(discussionThreadsTable);

  const threads = await db
    .select()
    .from(discussionThreadsTable)
    .orderBy(desc(discussionThreadsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    data: threads.map((t) => ({
      id: t.id,
      title: t.title,
      body: t.body,
      authorId: t.authorId,
      authorName: t.authorName,
      authorRole: t.authorRole,
      replyCount: t.replyCount,
      createdAt: t.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, hasMore: offset + threads.length < total },
  });
});

router.post("/threads", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (user?.role !== "trekker") {
    res.status(403).json({ error: "Only trekkers can start new discussions" });
    return;
  }
  const { title, body } = req.body as { title?: string; body?: string };
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "Title and body are required" });
    return;
  }
  const name = displayName(user, user.role);
  const [thread] = await db
    .insert(discussionThreadsTable)
    .values({
      title: title.trim(),
      body: body.trim(),
      authorId: req.user.id,
      authorName: name,
      authorRole: user.role,
      replyCount: 0,
    })
    .returning();
  res.status(201).json({
    id: thread.id,
    title: thread.title,
    body: thread.body,
    authorId: thread.authorId,
    authorName: thread.authorName,
    authorRole: thread.authorRole,
    replyCount: thread.replyCount,
    createdAt: thread.createdAt.toISOString(),
  });
});

router.get("/threads/:threadId", async (req: Request, res: Response) => {
  const [thread] = await db
    .select()
    .from(discussionThreadsTable)
    .where(eq(discussionThreadsTable.id, req.params.threadId));
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  const replies = await db
    .select()
    .from(threadRepliesTable)
    .where(eq(threadRepliesTable.threadId, req.params.threadId))
    .orderBy(threadRepliesTable.createdAt);
  res.json({
    id: thread.id,
    title: thread.title,
    body: thread.body,
    authorId: thread.authorId,
    authorName: thread.authorName,
    authorRole: thread.authorRole,
    replyCount: thread.replyCount,
    createdAt: thread.createdAt.toISOString(),
    replies: replies.map((r) => ({
      id: r.id,
      threadId: r.threadId,
      body: r.body,
      authorId: r.authorId,
      authorName: r.authorName,
      authorRole: r.authorRole,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

router.post("/threads/:threadId/replies", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [thread] = await db
    .select()
    .from(discussionThreadsTable)
    .where(eq(discussionThreadsTable.id, req.params.threadId));
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }
  const { body } = req.body as { body?: string };
  if (!body?.trim()) {
    res.status(400).json({ error: "Reply body is required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  const name = displayName(user, user?.role);
  const [reply] = await db
    .insert(threadRepliesTable)
    .values({
      threadId: req.params.threadId,
      body: body.trim(),
      authorId: req.user.id,
      authorName: name,
      authorRole: user?.role ?? null,
    })
    .returning();
  await db
    .update(discussionThreadsTable)
    .set({ replyCount: sql`reply_count + 1`, updatedAt: new Date() })
    .where(eq(discussionThreadsTable.id, req.params.threadId));
  res.status(201).json({
    id: reply.id,
    threadId: reply.threadId,
    body: reply.body,
    authorId: reply.authorId,
    authorName: reply.authorName,
    authorRole: reply.authorRole,
    createdAt: reply.createdAt.toISOString(),
  });
});

export default router;
