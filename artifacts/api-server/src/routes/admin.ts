import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, bookingsTable, treksTable, sosAlertsTable, userPermitsTable, permitTypesTable } from "@workspace/db";
import { eq, and, gte, desc, count, sum, sql, or, like, inArray } from "drizzle-orm";
import { createNotification } from "../lib/notify";
import crypto from "crypto";

const router: IRouter = Router();

/** Admin guard — reusable check */
async function isAdmin(req: Request, res: Response): Promise<boolean> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user.id));
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// GET /admin/overview
// ---------------------------------------------------------------------------
router.get("/admin/overview", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [[userCounts], [bookingStats], [commissionStats], [pendingVerifications], [unresolvedSos], [activeTreks]] = await Promise.all([
    db.select({
      totalUsers: count(),
      totalTrekkers: sql<number>`COUNT(*) FILTER (WHERE role = 'trekker')`,
      totalAgencies: sql<number>`COUNT(*) FILTER (WHERE role = 'agency')`,
    }).from(usersTable),
    db.select({ total: count() }).from(bookingsTable).where(and(eq(bookingsTable.status, "paid"), gte(bookingsTable.createdAt, startOfMonth))),
    db.select({ total: sql<string>`COALESCE(SUM(platform_fee_amount::numeric), 0)` }).from(bookingsTable).where(and(eq(bookingsTable.status, "paid"), gte(bookingsTable.createdAt, startOfMonth))),
    db.select({ total: count() }).from(usersTable).where(eq(usersTable.verificationStatus, "pending")),
    db.select({ total: count() }).from(sosAlertsTable).where(eq(sosAlertsTable.resolved, false)),
    db.select({ total: count() }).from(treksTable).where(eq(treksTable.status, "active")),
  ]);

  res.json({
    totalUsers: userCounts.totalUsers,
    totalTrekkers: userCounts.totalTrekkers,
    totalAgencies: userCounts.totalAgencies,
    totalBookingsThisMonth: bookingStats.total,
    totalCommissionThisMonth: Number(commissionStats.total),
    pendingVerificationsCount: pendingVerifications.total,
    unresolvedSosCount: unresolvedSos.total,
    totalActiveTreks: activeTreks.total,
  });
});

// ---------------------------------------------------------------------------
// GET /admin/users — paginated, searchable
// ---------------------------------------------------------------------------
router.get("/admin/users", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const offset = (page - 1) * limit;
  const search = (req.query.search as string)?.trim();

  let where = undefined;
  if (search) {
    where = or(
      like(usersTable.username, `%${search}%`),
      like(usersTable.email, `%${search}%`),
    );
  }

  const [{ total }] = await db.select({ total: count() }).from(usersTable).where(where);

  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      role: usersTable.role,
      verificationStatus: usersTable.verificationStatus,
      isVerified: usersTable.isVerified,
      isBanned: usersTable.isBanned,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(where)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    data: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    pagination: { page, limit, total, hasMore: offset + users.length < total },
  });
});

// ---------------------------------------------------------------------------
// POST /admin/users/:id/ban — toggle ban
// ---------------------------------------------------------------------------
router.post("/admin/users/:id/ban", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  const [user] = await db.select({ isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, req.params.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [updated] = await db
    .update(usersTable)
    .set({ isBanned: !user.isBanned, updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.id))
    .returning({ isBanned: usersTable.isBanned });

  res.json({ id: req.params.id, isBanned: updated.isBanned });
});

// ---------------------------------------------------------------------------
// GET /admin/bookings — paginated
// ---------------------------------------------------------------------------
router.get("/admin/bookings", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const offset = (page - 1) * limit;

  const [{ total }] = await db.select({ total: count() }).from(bookingsTable);

  const bookings = await db
    .select({
      id: bookingsTable.id,
      trekkerId: bookingsTable.trekkerId,
      trekId: bookingsTable.trekId,
      totalAmount: bookingsTable.totalAmount,
      platformFeeAmount: bookingsTable.platformFeeAmount,
      status: bookingsTable.status,
      createdAt: bookingsTable.createdAt,
      trekTitle: treksTable.title,
      agencyId: treksTable.agencyId,
    })
    .from(bookingsTable)
    .leftJoin(treksTable, eq(bookingsTable.trekId, treksTable.id))
    .orderBy(desc(bookingsTable.createdAt))
    .limit(limit)
    .offset(offset);

  // Resolve usernames
  const userIds = [...new Set([...bookings.map((b) => b.trekkerId), ...bookings.filter((b) => b.agencyId).map((b) => b.agencyId!)])];
  const users = userIds.length > 0 ? await db.select({ id: usersTable.id, username: usersTable.username, agencyName: usersTable.agencyName }).from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  res.json({
    data: bookings.map((b) => ({
      id: b.id,
      trekkerUsername: userMap[b.trekkerId]?.username ? `@${userMap[b.trekkerId].username}` : b.trekkerId,
      trekTitle: b.trekTitle ?? "Custom Trip",
      agencyName: b.agencyId ? (userMap[b.agencyId]?.agencyName ?? null) : null,
      totalAmount: Number(b.totalAmount),
      platformFeeAmount: Number(b.platformFeeAmount),
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    })),
    pagination: { page, limit, total, hasMore: offset + bookings.length < total },
  });
});

// ---------------------------------------------------------------------------
// GET /admin/sos — all SOS alerts
// ---------------------------------------------------------------------------
router.get("/admin/sos", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  const alerts = await db
    .select({
      id: sosAlertsTable.id,
      userId: sosAlertsTable.userId,
      trekName: sosAlertsTable.trekName,
      lastKnownDestination: sosAlertsTable.lastKnownDestination,
      triggeredAt: sosAlertsTable.triggeredAt,
      resolved: sosAlertsTable.resolved,
      resolvedAt: sosAlertsTable.resolvedAt,
      username: usersTable.username,
    })
    .from(sosAlertsTable)
    .leftJoin(usersTable, eq(sosAlertsTable.userId, usersTable.id))
    .orderBy(desc(sosAlertsTable.triggeredAt));

  res.json(alerts.map((a) => ({
    id: a.id,
    trekkerUsername: a.username ? `@${a.username}` : "Unknown",
    trekName: a.trekName,
    destination: a.lastKnownDestination,
    triggeredAt: a.triggeredAt.toISOString(),
    resolved: a.resolved,
    resolvedAt: a.resolvedAt?.toISOString() ?? null,
  })));
});

// ---------------------------------------------------------------------------
// POST /admin/sos/:id/resolve
// ---------------------------------------------------------------------------
router.post("/admin/sos/:id/resolve", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  const [updated] = await db
    .update(sosAlertsTable)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(eq(sosAlertsTable.id, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Alert not found" }); return; }
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /admin/offline-permits
// ---------------------------------------------------------------------------
router.get("/admin/offline-permits", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  const permits = await db
    .select({
      id: userPermitsTable.id,
      userId: userPermitsTable.userId,
      permitTypeId: userPermitsTable.permitTypeId,
      createdAt: userPermitsTable.createdAt,
      permitName: permitTypesTable.permitName,
      destination: permitTypesTable.destination,
      priceNPR: permitTypesTable.priceNPR,
      username: usersTable.username,
    })
    .from(userPermitsTable)
    .leftJoin(permitTypesTable, eq(userPermitsTable.permitTypeId, permitTypesTable.id))
    .leftJoin(usersTable, eq(userPermitsTable.userId, usersTable.id))
    .where(and(eq(userPermitsTable.paymentMethod, "offline"), eq(userPermitsTable.status, "offline_pending")))
    .orderBy(desc(userPermitsTable.createdAt));

  res.json(permits.map((p) => ({
    id: p.id,
    trekkerUsername: p.username ? `@${p.username}` : "Unknown",
    permitName: p.permitName,
    destination: p.destination,
    priceNPR: p.priceNPR,
    createdAt: p.createdAt.toISOString(),
  })));
});

// ---------------------------------------------------------------------------
// POST /admin/offline-permits/:id/confirm
// ---------------------------------------------------------------------------
router.post("/admin/offline-permits/:id/confirm", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  const permitNumber = `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const [updated] = await db
    .update(userPermitsTable)
    .set({ status: "paid", paidAt: new Date(), permitNumber })
    .where(eq(userPermitsTable.id, req.params.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Permit not found" }); return; }

  createNotification({
    userId: updated.userId,
    title: "Offline Permit Confirmed",
    message: `Your offline permit payment has been confirmed. Permit number: ${permitNumber}`,
    type: "bid_selected",
    actionUrl: "/profile",
  }).catch(() => {});

  res.json({ success: true, permitNumber });
});

// ---------------------------------------------------------------------------
// GET /admin/revenue — enhanced with monthly chart data
// ---------------------------------------------------------------------------
router.get("/admin/revenue", async (req: Request, res: Response) => {
  if (!(await isAdmin(req, res))) return;

  // All-time stats
  const [allTime] = await db
    .select({
      totalCommission: sql<string>`COALESCE(SUM(platform_fee_amount::numeric), 0)`,
      totalBookingValue: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
      totalBookings: count(),
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.status, "paid"));

  // This month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [thisMonth] = await db
    .select({ monthlyCommission: sql<string>`COALESCE(SUM(platform_fee_amount::numeric), 0)` })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.status, "paid"), gte(bookingsTable.createdAt, startOfMonth)));

  // Last 6 months chart data
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const monthlyData = await db.execute(
    sql`SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          COALESCE(SUM(platform_fee_amount::numeric), 0) as commission,
          COUNT(*)::int as bookings
        FROM bookings
        WHERE status = 'paid' AND created_at >= ${sixMonthsAgo}
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month ASC`
  );
  const monthlyRows = (monthlyData as unknown as { rows: Array<{ month: string; commission: string; bookings: number }> }).rows ?? [];

  // Top 10 agencies
  const topAgencies = await db
    .select({
      agencyId: treksTable.agencyId,
      bookingCount: count(),
      totalValue: sql<string>`COALESCE(SUM(${bookingsTable.totalAmount}::numeric), 0)`,
    })
    .from(bookingsTable)
    .innerJoin(treksTable, eq(bookingsTable.trekId, treksTable.id))
    .where(eq(bookingsTable.status, "paid"))
    .groupBy(treksTable.agencyId)
    .orderBy(desc(count()))
    .limit(10);

  const agencyIds = topAgencies.map((a) => a.agencyId);
  const agencies = agencyIds.length > 0
    ? await db.select({ id: usersTable.id, agencyName: usersTable.agencyName, username: usersTable.username }).from(usersTable).where(inArray(usersTable.id, agencyIds))
    : [];
  const agencyMap = Object.fromEntries(agencies.map((a) => [a.id, a]));

  res.json({
    totalCommission: Number(allTime.totalCommission),
    totalBookingValue: Number(allTime.totalBookingValue),
    totalBookings: allTime.totalBookings,
    monthlyCommission: Number(thisMonth.monthlyCommission),
    monthlyChart: monthlyRows.map((r) => ({ month: r.month, commission: Number(r.commission), bookings: r.bookings })),
    topAgencies: topAgencies.map((a) => ({
      agencyId: a.agencyId,
      agencyName: agencyMap[a.agencyId]?.agencyName ?? null,
      username: agencyMap[a.agencyId]?.username ?? null,
      bookingCount: a.bookingCount,
      totalValue: Number(a.totalValue),
    })),
  });
});

export default router;
