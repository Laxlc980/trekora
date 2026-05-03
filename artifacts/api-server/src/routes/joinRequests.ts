import { Router, type IRouter, type Request, type Response } from "express";
import { db, joinRequestsTable, treksTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateJoinRequestBody, UpdateJoinRequestBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function formatJoinRequest(jr: typeof joinRequestsTable.$inferSelect) {
  const [trekker] = await db.select().from(usersTable).where(eq(usersTable.id, jr.trekkerId));
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, jr.trekId));
  const [agency] = trek ? await db.select().from(usersTable).where(eq(usersTable.id, trek.agencyId)) : [null];
  return {
    id: jr.id,
    trekId: jr.trekId,
    trekkerId: jr.trekkerId,
    trekkerName: trekker ? `${trekker.firstName ?? ""} ${trekker.lastName ?? ""}`.trim() || trekker.email : null,
    trekkerEmail: trekker?.email ?? null,
    trekkerProfileImage: trekker?.profileImageUrl ?? null,
    trek: trek ? {
      id: trek.id,
      agencyId: trek.agencyId,
      agencyName: agency?.agencyName ?? null,
      title: trek.title,
      destination: trek.destination,
      duration: trek.duration,
      startDate: trek.startDate,
      endDate: trek.endDate ?? null,
      price: Number(trek.price),
      maxGroupSize: trek.maxGroupSize,
      description: trek.description,
      imageUrl: trek.imageUrl ?? null,
      status: trek.status,
      currentParticipants: trek.currentParticipants,
      difficultyLevel: trek.difficultyLevel,
      createdAt: trek.createdAt.toISOString(),
    } : undefined,
    status: jr.status as "pending" | "accepted" | "rejected",
    message: jr.message ?? null,
    createdAt: jr.createdAt.toISOString(),
  };
}

router.get("/treks/:trekId/join-requests", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const requests = await db
    .select()
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.trekId, req.params.trekId));
  const formatted = await Promise.all(requests.map(formatJoinRequest));
  res.json(formatted);
});

router.post("/treks/:trekId/join-requests", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, req.params.trekId));
  if (!trek) {
    res.status(404).json({ error: "Trek not found" });
    return;
  }
  const parsed = CreateJoinRequestBody.safeParse(req.body);
  const [existing] = await db
    .select()
    .from(joinRequestsTable)
    .where(and(eq(joinRequestsTable.trekId, req.params.trekId), eq(joinRequestsTable.trekkerId, req.user.id)));
  if (existing) {
    res.status(400).json({ error: "You already have a join request for this trek" });
    return;
  }
  const [jr] = await db
    .insert(joinRequestsTable)
    .values({
      trekId: req.params.trekId,
      trekkerId: req.user.id,
      agencyId: trek.agencyId,
      message: parsed.success ? (parsed.data.message ?? null) : null,
      status: "pending",
    })
    .returning();
  res.status(201).json(await formatJoinRequest(jr));
});

router.get("/join-requests/:requestId", async (req: Request, res: Response) => {
  const [jr] = await db.select().from(joinRequestsTable).where(eq(joinRequestsTable.id, req.params.requestId));
  if (!jr) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(await formatJoinRequest(jr));
});

router.put("/join-requests/:requestId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpdateJoinRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [jr] = await db.select().from(joinRequestsTable).where(eq(joinRequestsTable.id, req.params.requestId));
  if (!jr) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Verify logged-in user owns the trek (agencyId match)
  if (jr.agencyId !== req.user.id) {
    res.status(403).json({ error: "Forbidden - not the trek owner" });
    return;
  }
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, jr.trekId));
  if (!trek) {
    res.status(404).json({ error: "Trek not found" });
    return;
  }
  const [updated] = await db
    .update(joinRequestsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(joinRequestsTable.id, req.params.requestId))
    .returning();

  if (parsed.data.status === "accepted") {
    await db
      .update(treksTable)
      .set({ currentParticipants: trek.currentParticipants + 1, updatedAt: new Date() })
      .where(eq(treksTable.id, jr.trekId));
  }

  res.json(await formatJoinRequest(updated));
});

export default router;
