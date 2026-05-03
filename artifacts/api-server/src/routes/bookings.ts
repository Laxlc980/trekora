import { Router, type IRouter, type Request, type Response } from "express";
import { db, bookingsTable, treksTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateBookingBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

const CANCELLATION_POLICY = "Cancellations made 7+ days before the trek start date are eligible for a 50% refund of the advance payment. No refunds for cancellations within 7 days of the trek. The remaining balance is due upon arrival.";

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
  const paymentRef = `TMN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      trekkerId: req.user.id,
      trekId,
      bidId,
      totalAmount: String(totalAmount),
      advanceAmount: String(advanceAmount),
      status: "paid",
      paymentRef,
      cancellationPolicy: CANCELLATION_POLICY,
    })
    .returning();
  res.status(201).json(await formatBooking(booking));
});

router.get("/bookings/:bookingId", async (req: Request, res: Response) => {
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, req.params.bookingId));
  if (!booking) {
    res.status(404).json({ error: "Not found" });
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

export default router;
