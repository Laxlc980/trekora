// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, bookingsTable, treksTable, usersTable } from "@workspace/db";
import { eq, sql, and, gte, desc, inArray, count, sum } from "drizzle-orm";
import { CreateBookingBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

const CANCELLATION_POLICY = "Cancellations made 7+ days before the trek start date are eligible for a 50% refund of the advance payment. No refunds for cancellations within 7 days of the trek. The remaining balance is due upon arrival.";

/** Read commission percentage from env, default 5% */
function getPlatformFeePercent(): number {
  const raw = process.env.PLATFORM_COMMISSION_PERCENT;
  if (!raw) return 5;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5;
}

async function formatBooking(b: typeof bookingsTable.$inferSelect) {
  let trek = null;
  if (b.trekId) {
    const [t] = await db.select().from(treksTable).where(eq(treksTable.id, b.trekId));
    if (t) {
      const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, t.agencyId));
      trek = {
        id: t.id,
        agencyId: t.agencyId,
        agencyName: agency?.agencyName ?? null,
        title: t.title,
        destination: t.destination,
        duration: t.duration,
        startDate: t.startDate,
        endDate: t.endDate ?? null,
        price: Number(t.price),
        maxGroupSize: t.maxGroupSize,
        description: t.description,
        imageUrl: t.imageUrl ?? null,
        status: t.status,
        currentParticipants: t.currentParticipants,
        difficultyLevel: t.difficultyLevel,
        createdAt: t.createdAt.toISOString(),
      };
    }
  }
  return {
    id: b.id,
    trekkerId: b.trekkerId,
    trekId: b.trekId ?? null,
    bidId: b.bidId ?? null,
    trek,
    totalAmount: Number(b.totalAmount),
    advanceAmount: Number(b.advanceAmount),
    platformFeePercent: Number(b.platformFeePercent),
    platformFeeAmount: Number(b.platformFeeAmount),
    status: b.status as "pending" | "paid" | "cancelled",
    paymentRef: b.paymentRef ?? null,
    cancellationPolicy: b.cancellationPolicy ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

router.get("/bookings", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const bookings = await db.select().from(bookingsTable).where(eq(bookingsTable.trekkerId, req.user.id));
  const formatted = await Promise.all(bookings.map(formatBooking));
  res.json(formatted);
});

router.post("/bookings", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  let totalAmount = 0;
  let trekId: string | null = parsed.data.trekId ?? null;
  let bidId: string | null = parsed.data.bidId ?? null;

  if (trekId) {
    const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, trekId));
    if (!trek) {
      res.status(404).json({ error: "Trek not found" });
      return;
    }
    if (trek.currentParticipants >= trek.maxGroupSize) {
      res.status(409).json({ error: "This trek is fully booked" });
      return;
    }
    totalAmount = Number(trek.price);
  } else if (bidId) {
    const { bidsTable: bids } = await import("@workspace/db");
    const [bid] = await db.select().from(bids).where(eq(bids.id, bidId));
    if (!bid) {
      res.status(404).json({ error: "Bid not found" });
      return;
    }
    totalAmount = Number(bid.proposedPrice);
  } else {
    res.status(400).json({ error: "Either trekId or bidId is required" });
    return;
  }

  const advanceAmount = totalAmount * 0.3;
  const platformFeePercent = getPlatformFeePercent();
  const platformFeeAmount = (totalAmount * platformFeePercent) / 100;
  const paymentRef = `TMN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      trekkerId: req.user.id,
      trekId,
      bidId,
      totalAmount: String(totalAmount),
      advanceAmount: String(advanceAmount),
      platformFeePercent: String(platformFeePercent),
      platformFeeAmount: String(platformFeeAmount),
      status: "paid",
      paymentRef,
      cancellationPolicy: CANCELLATION_POLICY,
    })
    .returning();

  // Atomically increment participant count so concurrent bookings can't
  // both read the same value and both succeed past the capacity check.
  if (trekId) {
    await db
      .update(treksTable)
      .set({ currentParticipants: sql`current_participants + 1`, updatedAt: new Date() })
      .where(eq(treksTable.id, trekId));
  }

  res.status(201).json(await formatBooking(booking));
});

router.get("/bookings/:bookingId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.bookingId));
  if (!booking) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (booking.trekkerId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(await formatBooking(booking));
});

router.delete("/bookings/:bookingId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.bookingId));
  if (!booking || booking.trekkerId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(bookingsTable.id, req.params.bookingId))
    .returning();
  res.json(await formatBooking(updated));
});

// ---------------------------------------------------------------------------
// GET /admin/revenue — admin-only platform revenue stats
// ---------------------------------------------------------------------------
router.get("/admin/revenue", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check admin role
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user.id));
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }

  // All-time stats
  const [allTime] = await db
    .select({
      totalCommission: sql<string>`COALESCE(SUM(platform_fee_amount::numeric), 0)`,
      totalBookingValue: sql<string>`COALESCE(SUM(total_amount::numeric), 0)`,
      totalBookings: count(),
    })
    .from(bookingsTable)
    .where(eq(bookingsTable.status, "paid"));

  // This month stats
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [thisMonth] = await db
    .select({
      monthlyCommission: sql<string>`COALESCE(SUM(platform_fee_amount::numeric), 0)`,
    })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.status, "paid"), gte(bookingsTable.createdAt, startOfMonth)));

  // Top 10 agencies by booking volume
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

  // Resolve agency names
  const agencyIds = topAgencies.map((a) => a.agencyId);
  const agencies = agencyIds.length > 0
    ? await db.select({ id: usersTable.id, agencyName: usersTable.agencyName, username: usersTable.username }).from(usersTable).where(inArray(usersTable.id, agencyIds))
    : [];
  const agencyMap = Object.fromEntries(agencies.map((a) => [a.id, { name: a.agencyName, username: a.username }]));

  res.json({
    totalCommission: Number(allTime.totalCommission),
    totalBookingValue: Number(allTime.totalBookingValue),
    totalBookings: allTime.totalBookings,
    monthlyCommission: Number(thisMonth.monthlyCommission),
    topAgencies: topAgencies.map((a) => ({
      agencyId: a.agencyId,
      agencyName: agencyMap[a.agencyId]?.name ?? null,
      username: agencyMap[a.agencyId]?.username ?? null,
      bookingCount: a.bookingCount,
      totalValue: Number(a.totalValue),
    })),
  });
});

export default router;
