import { Router, type IRouter, type Request, type Response } from "express";
import { db, joinRequestsTable, customRequestsTable, bookingsTable, treksTable, usersTable, bidsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/trekker", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const trekkerId = req.user.id;

  const allRequests = await db.select().from(joinRequestsTable).where(eq(joinRequestsTable.trekkerId, trekkerId));

  const formatJr = async (jr: typeof joinRequestsTable.$inferSelect) => {
    const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, jr.trekId));
    const [agency] = trek ? await db.select().from(usersTable).where(eq(usersTable.id, trek.agencyId)) : [null];
    return {
      id: jr.id,
      trekId: jr.trekId,
      trekkerId: jr.trekkerId,
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

  const customRequests = await db.select().from(customRequestsTable).where(eq(customRequestsTable.trekkerId, trekkerId));
  const formatCr = async (cr: typeof customRequestsTable.$inferSelect) => {
    const bidsCount = Number((await db.execute(sql`SELECT COUNT(*)::int as count FROM bids WHERE custom_request_id = ${cr.id}`) as unknown as { rows: Array<{ count: number }> }).rows[0]?.count ?? 0);
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
  const upcomingTreks = joinedFormatted.length;

  res.json({
    joinedTreks: joinedFormatted,
    pendingRequests: pendingFormatted,
    customRequests: await Promise.all(customRequests.map(formatCr)),
    totalSpent,
    upcomingTreks,
  });
});

router.get("/dashboard/agency", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const agencyId = req.user.id;
  const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, agencyId));

  const myTreks = await db.select().from(treksTable).where(eq(treksTable.agencyId, agencyId));
  const formattedTreks = myTreks.map((t) => ({
    id: t.id, agencyId: t.agencyId, agencyName: agency?.agencyName ?? null,
    title: t.title, destination: t.destination, duration: t.duration,
    startDate: t.startDate, endDate: t.endDate ?? null, price: Number(t.price),
    maxGroupSize: t.maxGroupSize, description: t.description, imageUrl: t.imageUrl ?? null,
    status: t.status, currentParticipants: t.currentParticipants, difficultyLevel: t.difficultyLevel,
    createdAt: t.createdAt.toISOString(),
  }));

  const trekIds = myTreks.map((t) => t.id);
  let pendingJoinRequests: Record<string, unknown>[] = [];
  if (trekIds.length > 0) {
    const allJrs = await db.execute(
      sql`SELECT * FROM join_requests WHERE trek_id = ANY(${trekIds}) AND status = 'pending' ORDER BY created_at DESC`
    );
    const jrRows = (allJrs as unknown as { rows: Array<Record<string, unknown>> }).rows;
    pendingJoinRequests = await Promise.all(jrRows.map(async (row) => {
      const [trekker] = await db.select().from(usersTable).where(eq(usersTable.id, row.trekker_id as string));
      const [trek] = myTreks.filter((t) => t.id === row.trek_id);
      return {
        id: row.id, trekId: row.trek_id, trekkerId: row.trekker_id,
        trekkerName: trekker ? `${trekker.firstName ?? ""} ${trekker.lastName ?? ""}`.trim() || trekker.email : null,
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
        status: row.status, message: row.message ?? null, createdAt: row.created_at,
      };
    }));
  }

  const openCustomRequests = await db.select().from(customRequestsTable).where(eq(customRequestsTable.status, "open"));
  const formattedCRs = await Promise.all(openCustomRequests.map(async (cr) => {
    const [trekker] = await db.select().from(usersTable).where(eq(usersTable.id, cr.trekkerId));
    const bidsCountRes = await db.execute(sql`SELECT COUNT(*)::int as count FROM bids WHERE custom_request_id = ${cr.id}`);
    const bidsCount = Number((bidsCountRes as unknown as { rows: Array<{ count: number }> }).rows[0]?.count ?? 0);
    return {
      id: cr.id, trekkerId: cr.trekkerId,
      trekkerName: trekker ? `${trekker.firstName ?? ""} ${trekker.lastName ?? ""}`.trim() || trekker.email : null,
      destination: cr.destination, budget: Number(cr.budget), startDate: cr.startDate,
      endDate: cr.endDate ?? null, groupSize: cr.groupSize, notes: cr.notes ?? null,
      status: cr.status as "open" | "closed" | "cancelled", bidsCount, selectedBidId: cr.selectedBidId ?? null,
      createdAt: cr.createdAt.toISOString(),
    };
  }));

  const allBookingsRes = await db.execute(
    sql`SELECT b.* FROM bookings b INNER JOIN treks t ON b.trek_id = t.id WHERE t.agency_id = ${agencyId} AND b.status = 'paid'`
  );
  const bookingRows = (allBookingsRes as unknown as { rows: Array<{ advance_amount: string }> }).rows;
  const totalEarnings = bookingRows.reduce((sum, b) => sum + Number(b.advance_amount), 0);

  res.json({
    myTreks: formattedTreks,
    pendingJoinRequests,
    openCustomRequests: formattedCRs,
    totalEarnings,
    totalBookings: bookingRows.length,
  });
});

export default router;
