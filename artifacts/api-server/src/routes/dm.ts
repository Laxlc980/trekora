import { Router, type IRouter, type Request, type Response } from "express";
import { db, dmRequestsTable, dmMessagesTable, usersTable } from "@workspace/db";
import { eq, and, or, desc, asc } from "drizzle-orm";

const router: IRouter = Router();

/** Canonical conversation ID — always smaller userId first for consistency. */
function conversationId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

// ---------------------------------------------------------------------------
// POST /dm/request  — send a DM request to a username
// ---------------------------------------------------------------------------
router.post("/dm/request", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { username } = req.body as { username?: string };
  if (!username?.trim()) { res.status(400).json({ error: "username is required" }); return; }

  const [target] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.username, username.trim()));

  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.id === req.user.id) { res.status(400).json({ error: "Cannot send a DM request to yourself" }); return; }

  // Check for existing request in either direction
  const [existing] = await db
    .select()
    .from(dmRequestsTable)
    .where(
      or(
        and(eq(dmRequestsTable.fromUserId, req.user.id), eq(dmRequestsTable.toUserId, target.id)),
        and(eq(dmRequestsTable.fromUserId, target.id), eq(dmRequestsTable.toUserId, req.user.id)),
      ),
    );

  if (existing) {
    res.status(409).json({ error: "A DM request already exists between these users", status: existing.status });
    return;
  }

  const [request] = await db
    .insert(dmRequestsTable)
    .values({ fromUserId: req.user.id, toUserId: target.id, status: "pending" })
    .returning();

  res.status(201).json(request);
});

// ---------------------------------------------------------------------------
// POST /dm/request/:id/accept
// ---------------------------------------------------------------------------
router.post("/dm/request/:id/accept", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [dmReq] = await db.select().from(dmRequestsTable).where(eq(dmRequestsTable.id, req.params.id));
  if (!dmReq) { res.status(404).json({ error: "Request not found" }); return; }
  if (dmReq.toUserId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (dmReq.status !== "pending") { res.status(409).json({ error: "Request is no longer pending" }); return; }

  const [updated] = await db
    .update(dmRequestsTable)
    .set({ status: "accepted" })
    .where(eq(dmRequestsTable.id, req.params.id))
    .returning();

  res.json(updated);
});

// ---------------------------------------------------------------------------
// POST /dm/request/:id/reject
// ---------------------------------------------------------------------------
router.post("/dm/request/:id/reject", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [dmReq] = await db.select().from(dmRequestsTable).where(eq(dmRequestsTable.id, req.params.id));
  if (!dmReq) { res.status(404).json({ error: "Request not found" }); return; }
  if (dmReq.toUserId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  if (dmReq.status !== "pending") { res.status(409).json({ error: "Request is no longer pending" }); return; }

  const [updated] = await db
    .update(dmRequestsTable)
    .set({ status: "rejected" })
    .where(eq(dmRequestsTable.id, req.params.id))
    .returning();

  res.json(updated);
});

// ---------------------------------------------------------------------------
// GET /dm/requests  — list incoming pending requests with sender info
// ---------------------------------------------------------------------------
router.get("/dm/requests", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      id: dmRequestsTable.id,
      fromUserId: dmRequestsTable.fromUserId,
      status: dmRequestsTable.status,
      createdAt: dmRequestsTable.createdAt,
      fromUsername: usersTable.username,
      fromFirstName: usersTable.firstName,
      fromLastName: usersTable.lastName,
      fromProfileImage: usersTable.profileImageUrl,
    })
    .from(dmRequestsTable)
    .leftJoin(usersTable, eq(dmRequestsTable.fromUserId, usersTable.id))
    .where(and(eq(dmRequestsTable.toUserId, req.user.id), eq(dmRequestsTable.status, "pending")))
    .orderBy(desc(dmRequestsTable.createdAt));

  res.json(rows.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    fromUsername: r.fromUsername ?? null,
    fromDisplayName: r.fromUsername ? `@${r.fromUsername}` : `${r.fromFirstName ?? ""} ${r.fromLastName ?? ""}`.trim() || "Unknown",
    fromProfileImage: r.fromProfileImage ?? null,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  })));
});

// ---------------------------------------------------------------------------
// GET /dm/conversations  — list all accepted conversations with last message
// ---------------------------------------------------------------------------
router.get("/dm/conversations", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const accepted = await db
    .select()
    .from(dmRequestsTable)
    .where(
      and(
        eq(dmRequestsTable.status, "accepted"),
        or(
          eq(dmRequestsTable.fromUserId, req.user.id),
          eq(dmRequestsTable.toUserId, req.user.id),
        ),
      ),
    );

  if (accepted.length === 0) { res.json([]); return; }

  const conversations = await Promise.all(
    accepted.map(async (r) => {
      const otherId = r.fromUserId === req.user.id ? r.toUserId : r.fromUserId;
      const convId = conversationId(req.user.id, otherId);

      const [other] = await db
        .select({ username: usersTable.username, firstName: usersTable.firstName, lastName: usersTable.lastName, profileImageUrl: usersTable.profileImageUrl })
        .from(usersTable)
        .where(eq(usersTable.id, otherId));

      const [lastMsg] = await db
        .select()
        .from(dmMessagesTable)
        .where(eq(dmMessagesTable.conversationId, convId))
        .orderBy(desc(dmMessagesTable.createdAt))
        .limit(1);

      const unreadCount = await db
        .select({ id: dmMessagesTable.id })
        .from(dmMessagesTable)
        .where(and(eq(dmMessagesTable.conversationId, convId), eq(dmMessagesTable.senderId, otherId), eq(dmMessagesTable.read, false)));

      return {
        conversationId: convId,
        otherUserId: otherId,
        otherUsername: other?.username ?? null,
        otherDisplayName: other?.username ? `@${other.username}` : `${other?.firstName ?? ""} ${other?.lastName ?? ""}`.trim() || "Unknown",
        otherProfileImage: other?.profileImageUrl ?? null,
        lastMessage: lastMsg ? { body: lastMsg.body, createdAt: lastMsg.createdAt.toISOString(), fromMe: lastMsg.senderId === req.user.id } : null,
        unreadCount: unreadCount.length,
      };
    }),
  );

  // Sort by most recent message
  conversations.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? "0";
    const bTime = b.lastMessage?.createdAt ?? "0";
    return bTime.localeCompare(aTime);
  });

  res.json(conversations);
});

// ---------------------------------------------------------------------------
// GET /dm/conversations/:userId  — get messages with a specific user
// ---------------------------------------------------------------------------
router.get("/dm/conversations/:userId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const otherId = req.params.userId;
  const convId = conversationId(req.user.id, otherId);

  // Verify accepted request exists
  const [accepted] = await db
    .select()
    .from(dmRequestsTable)
    .where(
      and(
        eq(dmRequestsTable.status, "accepted"),
        or(
          and(eq(dmRequestsTable.fromUserId, req.user.id), eq(dmRequestsTable.toUserId, otherId)),
          and(eq(dmRequestsTable.fromUserId, otherId), eq(dmRequestsTable.toUserId, req.user.id)),
        ),
      ),
    );

  if (!accepted) { res.status(403).json({ error: "No accepted DM connection with this user" }); return; }

  const messages = await db
    .select()
    .from(dmMessagesTable)
    .where(eq(dmMessagesTable.conversationId, convId))
    .orderBy(asc(dmMessagesTable.createdAt));

  // Mark incoming messages as read
  await db
    .update(dmMessagesTable)
    .set({ read: true })
    .where(and(eq(dmMessagesTable.conversationId, convId), eq(dmMessagesTable.senderId, otherId), eq(dmMessagesTable.read, false)));

  res.json(messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    fromMe: m.senderId === req.user.id,
    body: m.body,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  })));
});

// ---------------------------------------------------------------------------
// POST /dm/conversations/:userId  — send a message
// ---------------------------------------------------------------------------
router.post("/dm/conversations/:userId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const otherId = req.params.userId;
  const { body } = req.body as { body?: string };
  if (!body?.trim()) { res.status(400).json({ error: "Message body is required" }); return; }

  // Verify accepted request
  const [accepted] = await db
    .select()
    .from(dmRequestsTable)
    .where(
      and(
        eq(dmRequestsTable.status, "accepted"),
        or(
          and(eq(dmRequestsTable.fromUserId, req.user.id), eq(dmRequestsTable.toUserId, otherId)),
          and(eq(dmRequestsTable.fromUserId, otherId), eq(dmRequestsTable.toUserId, req.user.id)),
        ),
      ),
    );

  if (!accepted) { res.status(403).json({ error: "No accepted DM connection with this user" }); return; }

  const convId = conversationId(req.user.id, otherId);
  const [msg] = await db
    .insert(dmMessagesTable)
    .values({ conversationId: convId, senderId: req.user.id, body: body.trim() })
    .returning();

  res.status(201).json({
    id: msg.id,
    senderId: msg.senderId,
    fromMe: true,
    body: msg.body,
    read: msg.read,
    createdAt: msg.createdAt.toISOString(),
  });
});

export default router;
