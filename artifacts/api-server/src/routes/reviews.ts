import { Router, type IRouter, type Request, type Response } from "express";
import { db, reviewsTable, bookingsTable, treksTable, usersTable } from "@workspace/db";
import { eq, and, desc, avg, count } from "drizzle-orm";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// POST /treks/:trekId/reviews — trekker submits a review
// ---------------------------------------------------------------------------
router.post("/treks/:trekId/reviews", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const trekId = req.params.trekId;
  const { rating, title, body } = req.body as { rating?: number; title?: string; body?: string };

  // Validate input
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "rating must be an integer between 1 and 5" });
    return;
  }
  if (!title?.trim() || title.trim().length > 100) {
    res.status(400).json({ error: "title is required (max 100 characters)" });
    return;
  }
  if (!body?.trim() || body.trim().length > 1000) {
    res.status(400).json({ error: "body is required (max 1000 characters)" });
    return;
  }

  // Verify trek exists and get agency
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, trekId));
  if (!trek) {
    res.status(404).json({ error: "Trek not found" });
    return;
  }

  // Verify trekker has a paid booking for this trek AND the trek endDate has passed
  const today = new Date().toISOString().split("T")[0];
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.trekkerId, req.user.id),
      eq(bookingsTable.trekId, trekId),
      eq(bookingsTable.status, "paid"),
    ));

  // Filter to bookings where the trek end date has passed
  const qualifyingBooking = bookings.find((b) => {
    const endDate = trek.endDate ?? trek.startDate;
    return endDate <= today;
  });

  if (!qualifyingBooking) {
    res.status(403).json({ error: "You can only review a trek after it has ended and you have a paid booking for it" });
    return;
  }

  // Check if already reviewed this booking
  const [existing] = await db
    .select({ id: reviewsTable.id })
    .from(reviewsTable)
    .where(eq(reviewsTable.bookingId, qualifyingBooking.id));

  if (existing) {
    res.status(409).json({ error: "You have already reviewed this trek" });
    return;
  }

  const [review] = await db
    .insert(reviewsTable)
    .values({
      bookingId: qualifyingBooking.id,
      trekId,
      agencyId: trek.agencyId,
      trekkerId: req.user.id,
      rating,
      title: title.trim(),
      body: body.trim(),
    })
    .returning();

  // Get reviewer username for response
  const [reviewer] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  res.status(201).json({
    id: review.id,
    trekId: review.trekId,
    rating: review.rating,
    title: review.title,
    body: review.body,
    reviewerUsername: reviewer?.username ? `@${reviewer.username}` : "Anonymous",
    createdAt: review.createdAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// GET /treks/:trekId/reviews — list all reviews for a trek (no auth)
// ---------------------------------------------------------------------------
router.get("/treks/:trekId/reviews", async (req: Request, res: Response) => {
  const trekId = req.params.trekId;

  const reviews = await db
    .select({
      id: reviewsTable.id,
      trekId: reviewsTable.trekId,
      rating: reviewsTable.rating,
      title: reviewsTable.title,
      body: reviewsTable.body,
      createdAt: reviewsTable.createdAt,
      trekkerId: reviewsTable.trekkerId,
      username: usersTable.username,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.trekkerId, usersTable.id))
    .where(eq(reviewsTable.trekId, trekId))
    .orderBy(desc(reviewsTable.createdAt));

  res.json(reviews.map((r) => ({
    id: r.id,
    trekId: r.trekId,
    rating: r.rating,
    title: r.title,
    body: r.body,
    reviewerUsername: r.username ? `@${r.username}` : `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Anonymous",
    reviewerProfileImage: r.profileImageUrl ?? null,
    createdAt: r.createdAt.toISOString(),
  })));
});

// ---------------------------------------------------------------------------
// GET /agencies/:agencyId/reviews — all reviews for all treks by this agency
// ---------------------------------------------------------------------------
router.get("/agencies/:agencyId/reviews", async (req: Request, res: Response) => {
  const agencyId = req.params.agencyId;

  const reviews = await db
    .select({
      id: reviewsTable.id,
      trekId: reviewsTable.trekId,
      rating: reviewsTable.rating,
      title: reviewsTable.title,
      body: reviewsTable.body,
      createdAt: reviewsTable.createdAt,
      trekkerId: reviewsTable.trekkerId,
      username: usersTable.username,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      profileImageUrl: usersTable.profileImageUrl,
      trekTitle: treksTable.title,
    })
    .from(reviewsTable)
    .leftJoin(usersTable, eq(reviewsTable.trekkerId, usersTable.id))
    .leftJoin(treksTable, eq(reviewsTable.trekId, treksTable.id))
    .where(eq(reviewsTable.agencyId, agencyId))
    .orderBy(desc(reviewsTable.createdAt));

  // Also compute overall average
  const [stats] = await db
    .select({ avgRating: avg(reviewsTable.rating), reviewCount: count() })
    .from(reviewsTable)
    .where(eq(reviewsTable.agencyId, agencyId));

  res.json({
    averageRating: stats.avgRating ? Number(Number(stats.avgRating).toFixed(1)) : null,
    reviewCount: stats.reviewCount,
    reviews: reviews.map((r) => ({
      id: r.id,
      trekId: r.trekId,
      trekTitle: r.trekTitle ?? null,
      rating: r.rating,
      title: r.title,
      body: r.body,
      reviewerUsername: r.username ? `@${r.username}` : `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Anonymous",
      reviewerProfileImage: r.profileImageUrl ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
