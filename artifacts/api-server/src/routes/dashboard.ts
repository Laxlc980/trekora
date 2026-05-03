import { Router, type IRouter, type Request, type Response } from "express";
import { db, joinRequestsTable, customRequestsTable, bookingsTable, treksTable, usersTable, bidsTable } from "@workspace/db";
import { eq, sql, and, inArray, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/trekker", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const trekkerId = req.user.id;

  const allRequests = await db
    .select()
    .from(joinRequestsTable)
    .where(eq(joinRequestsTable.trekkerId, trekkerId))
    .orderBy(desc(joinRequestsTable.createdAt));

  const formatJr = async (jr: typeof joinRequestsTable.$inferSelect) => {
    const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, jr.trekId));
    const [agency] = trek ? await db.select().from(usersTable).where(eq(usersTable.id, trek.agencyId)) : [null];
    return {
      id: jr.id,
      trekId: jr.trekId,
      trekkerId: jr.trekkerId,
      agencyId: jr.agencyId ?? null,
      trekkerName: null,
      trekkerEmail: null,
      trekkerProfileImage: null,
      trek: trek ? {
        id: trek.id, agencyId: trek.agencyId, agencyName: agency?.agencyName ?? null,
        title: trek.title, destination: trek.destination, duration: trek.duration,
        startDate: trek.startDate, endDate: trek.endDate ?? null, price: Number(trek.price),
        maxGroupSize: trek.maxGroupSize, description: trek.description, imageUrl: trek.imageUrl ?? null,
        status: trek.status, currentParticipants: trek.currentParticipants, difficultyLevel: trek.difficultyLevel,
        createdAt: trek.createdAt.toISOString(),
      } : undefined,
      status: jr.status as "pending" | "accepted" | "rejected",
      message: jr.message ?? null,
      createdAt: jr.createdAt.toISOString(),
    };
  };

  const joined = allRequests.filter((r) => r.status === "accepted");
  const pending = allRequests.filter((r) => r.status === "pending");

  const [joinedFormatted, pendingFormatted] = await Promise.all([
    Promise.all(joined.map(formatJr)),
    Promise.all(pending.map(formatJr)),
  ]);

  const customRequests = await db
    .select()
    .from(customRequestsTable)
    .where(eq(customRequestsTable.trekkerId, trekkerId))
    .orderBy(desc(customRequestsTable.createdAt));

  const formatCr = async (cr: typeof customRequestsTable.$inferSelect) => {
    const bidsCountResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(bidsTable)
      .where(eq(bidsTable.customRequestId, cr.id));
    const bidsCount = bidsCountResult[0]?.count ?? 0;
    return {
      id: cr.id, trekkerId: cr.trekkerId, trekkerName: null,
      destination: cr.destination, budget: Number(cr.budget), startDate: cr.startDate,
      endDate: cr.endDate ?? null, groupSize: cr.groupSize, notes: cr.notes ?? null,
      status: cr.status as "open" | "closed" | "cancelled", bidsCount, selectedBidId: cr.selectedBidId ?? null,
      createdAt: cr.createdAt.toISOString(),
    };
  };

  const allBookings = await db.select().from(bookingsTable).where(eq(bookingsTable.trekkerId, trekkerId));
  const totalSpent = allBookings.filter((b) => b.status === "paid").reduce((sum, b) => sum + Number(b.advanceAmount), 0);

  res.json({
    joinedTreks: joinedFormatted,
    pendingRequests: pendingFormatted,
    customRequests: await Promise.all(customRequests.map(formatCr)),
    totalSpent,
    upcomingTreks: joinedFormatted.length,
  });
});

router.get("/dashboard/agency", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const agencyId = req.user.id;
  const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, agencyId));

  // My treks
  const myTreks = await db
    .select()
    .from(treksTable)
    .where(eq(treksTable.agencyId, agencyId))
    .orderBy(desc(treksTable.createdAt));

  const formattedTreks = myTreks.map((t) => ({
    id: t.id, agencyId: t.agencyId, agencyName: agency?.agencyName ?? null,
    title: t.title, destination: t.destination, duration: t.duration,
    startDate: t.startDate, endDate: t.endDate ?? null, price: Number(t.price),
    maxGroupSize: t.maxGroupSize, description: t.description, imageUrl: t.imageUrl ?? null,
    status: t.status, currentParticipants: t.currentParticipants, difficultyLevel: t.difficultyLevel,
    createdAt: t.createdAt.toISOString(),
  }));

  // All join requests for this agency — query by trekIds using inArray
  let pendingJoinRequests: Record<string, unknown>[] = [];
  let allJoinRequests: Record<string, unknown>[] = [];
  const trekIds = myTreks.map((t) => t.id);

  if (trekIds.length > 0) {
    const allJrRows = await db
      .select()
      .from(joinRequestsTable)
      .where(inArray(joinRequestsTable.trekId, trekIds))
      .orderBy(desc(joinRequestsTable.createdAt));

    const formatJr = async (jr: typeof joinRequestsTable.$inferSelect) => {
      const [trekker] = await db.select().from(usersTable).where(eq(usersTable.id, jr.trekkerId));
      const trek = myTreks.find((t) => t.id === jr.trekId);
      return {
        id: jr.id,
        trekId: jr.trekId,
        trekkerId: jr.trekkerId,
        agencyId: jr.agencyId ?? agencyId,
        trekkerName: trekker
          ? `${trekker.firstName ?? ""} ${trekker.lastName ?? ""}`.trim() || trekker.email
          : null,
        trekkerEmail: trekker?.email ?? null,
        trekkerProfileImage: trekker?.profileImageUrl ?? null,
        trek: trek ? {
          id: trek.id, agencyId: trek.agencyId, agencyName: agency?.agencyName ?? null,
          title: trek.title, destination: trek.destination, duration: trek.duration,
          startDate: trek.startDate, endDate: trek.endDate ?? null, price: Number(trek.price),
          maxGroupSize: trek.maxGroupSize, description: trek.description, imageUrl: trek.imageUrl ?? null,
          status: trek.status, currentParticipants: trek.currentParticipants, difficultyLevel: trek.difficultyLevel,
          createdAt: trek.createdAt.toISOString(),
        } : undefined,
        status: jr.status as "pending" | "accepted" | "rejected",
        message: jr.message ?? null,
        createdAt: jr.createdAt.toISOString(),
      };
    };

    allJoinRequests = await Promise.all(allJrRows.map(formatJr));
    pendingJoinRequests = allJoinRequests.filter((jr) => jr.status === "pending");
  }

  // Open custom requests visible to all agencies
  const openCustomRequests = await db
    .select()
    .from(customRequestsTable)
    .where(eq(customRequestsTable.status, "open"))
    .orderBy(desc(customRequestsTable.createdAt));

  const formattedCRs = await Promise.all(openCustomRequests.map(async (cr) => {
    const [trekker] = await db.select().from(usersTable).where(eq(usersTable.id, cr.trekkerId));
    const bidsCountResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(bidsTable)
      .where(eq(bidsTable.customRequestId, cr.id));
    const bidsCount = bidsCountResult[0]?.count ?? 0;

    // Check if this agency already bid on this request
    const [myBid] = await db
      .select()
      .from(bidsTable)
      .where(and(eq(bidsTable.customRequestId, cr.id), eq(bidsTable.agencyId, agencyId)));

    return {
      id: cr.id, trekkerId: cr.trekkerId,
      trekkerName: trekker
        ? `${trekker.firstName ?? ""} ${trekker.lastName ?? ""}`.trim() || trekker.email
        : null,
      destination: cr.destination, budget: Number(cr.budget), startDate: cr.startDate,
      endDate: cr.endDate ?? null, groupSize: cr.groupSize, notes: cr.notes ?? null,
      status: cr.status as "open" | "closed" | "cancelled",
      bidsCount,
      selectedBidId: cr.selectedBidId ?? null,
      myBidId: myBid?.id ?? null,
      createdAt: cr.createdAt.toISOString(),
    };
  }));

  // Agency earnings from bookings on their treks
  let totalEarnings = 0;
  let totalBookings = 0;
  if (trekIds.length > 0) {
    const agencyBookings = await db
      .select()
      .from(bookingsTable)
      .where(and(inArray(bookingsTable.trekId, trekIds), eq(bookingsTable.status, "paid")));
    totalEarnings = agencyBookings.reduce((sum, b) => sum + Number(b.advanceAmount), 0);
    totalBookings = agencyBookings.length;
  }

  res.json({
    myTreks: formattedTreks,
    pendingJoinRequests,
    allJoinRequests,
    openCustomRequests: formattedCRs,
    totalEarnings,
    totalBookings,
  });
});

export default router;
