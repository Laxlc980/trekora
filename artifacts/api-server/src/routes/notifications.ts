// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";

const router: IRouter = Router();

function parsePagination(query: Record<string, unknown>): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

router.get("/notifications", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { page, limit, offset } = parsePagination(req.query);
  const where = eq(notificationsTable.userId, req.user.id);

  const [{ total }] = await db
    .select({ total: count() })
    .from(notificationsTable)
    .where(where);

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(where)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(
    notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      title: n.title,
      message: n.message,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
  );
});

router.patch("/notifications/read-all", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, req.user.id), eq(notificationsTable.read, false)));
  res.json({ success: true });
});

router.patch("/notifications/:notificationId/read", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [updated] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(
      and(
        eq(notificationsTable.id, String(req.params.notificationId)),
        eq(notificationsTable.userId, req.user.id),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: updated.id,
    userId: updated.userId,
    title: updated.title,
    message: updated.message,
    type: updated.type,
    read: updated.read,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
