// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, bookingsTable, treksTable, discussionThreadsTable } from "@workspace/db";
import { eq, and, avg, count, desc } from "drizzle-orm";
import {
  SetUserRoleBody,
  UpdateMyProfileBody,
  CheckUsernameQueryParams,
  usernameMin,
  usernameMax,
  usernameRegex,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    agencyName: user.agencyName,
    bio: user.bio,
    phone: user.phone,
    location: user.location,
    isVerified: user.isVerified,
    verificationStatus: user.verificationStatus,
    verificationNote: user.verificationNote ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET /users/check-username?username=xxx  — no auth required
// ---------------------------------------------------------------------------
router.get("/users/check-username", async (req: Request, res: Response) => {
  const parsed = CheckUsernameQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "username query parameter is required" });
    return;
  }

  const { username } = parsed.data;

  // Validate format before hitting the DB
  if (
    username.length < usernameMin ||
    username.length > usernameMax ||
    !usernameRegex.test(username)
  ) {
    // Return available: false for invalid format — no need to query the DB
    res.json({ available: false, username });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username));

  res.json({ available: !existing, username });
});

// ---------------------------------------------------------------------------
// GET /users/me
// ---------------------------------------------------------------------------
router.get("/users/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUser(user));
});

// ---------------------------------------------------------------------------
// PUT /users/me
// ---------------------------------------------------------------------------
router.put("/users/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(usersTable.id, req.user.id))
    .returning();
  res.json(formatUser(updated));
});

// ---------------------------------------------------------------------------
// POST /users/me/role  — sets role + username on first login
// Username is required and immutable once set.
// ---------------------------------------------------------------------------
router.post("/users/me/role", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SetUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { role, username, agencyName } = parsed.data;

  // Fetch current user to check if username is already set
  const [current] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  const updateData: Record<string, unknown> = { role, updatedAt: new Date() };

  if (current?.username) {
    // Username already set — silently keep it, don't allow change
  } else {
    // Check availability before setting
    const [taken] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username));

    if (taken) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }

    updateData.username = username;
  }

  if (agencyName) {
    updateData.agencyName = agencyName;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, req.user.id))
    .returning();

  res.json(formatUser(updated));
});

// ---------------------------------------------------------------------------
// GET /users/profile/:username  — public profile (no auth required)
// Private fields (email, phone) only included when viewing own profile.
// ---------------------------------------------------------------------------
router.get("/users/profile/:username", async (req: Request, res: Response) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, req.params.username));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const isOwnProfile = req.isAuthenticated() && req.user.id === user.id;

  const base = {
    id: user.id,
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    agencyName: user.agencyName,
    bio: user.bio,
    location: user.location,
    memberSince: user.createdAt.toISOString(),
    // Private fields — only on own profile
    email: isOwnProfile ? user.email : undefined,
    phone: isOwnProfile ? user.phone : undefined,
  };

  if (user.role === "trekker") {
    // Paid bookings with trek details
    const paidBookings = await db
      .select({
        bookingId: bookingsTable.id,
        trekId: treksTable.id,
        trekTitle: treksTable.title,
        trekDestination: treksTable.destination,
        trekDuration: treksTable.duration,
        trekDifficulty: treksTable.difficultyLevel,
        trekImageUrl: treksTable.imageUrl,
        bookingCreatedAt: bookingsTable.createdAt,
      })
      .from(bookingsTable)
      .leftJoin(treksTable, eq(bookingsTable.trekId, treksTable.id))
      .where(and(eq(bookingsTable.trekkerId, user.id), eq(bookingsTable.status, "paid")))
      .orderBy(desc(bookingsTable.createdAt));

    // Community threads posted by this user
    const threads = await db
      .select({
        id: discussionThreadsTable.id,
        title: discussionThreadsTable.title,
        replyCount: discussionThreadsTable.replyCount,
        createdAt: discussionThreadsTable.createdAt,
      })
      .from(discussionThreadsTable)
      .where(eq(discussionThreadsTable.authorId, user.id))
      .orderBy(desc(discussionThreadsTable.createdAt))
      .limit(20);

    res.json({
      ...base,
      completedTreks: paidBookings.map((b) => ({
        bookingId: b.bookingId,
        trekId: b.trekId,
        title: b.trekTitle,
        destination: b.trekDestination,
        duration: b.trekDuration,
        difficultyLevel: b.trekDifficulty,
        imageUrl: b.trekImageUrl ?? null,
        bookedAt: b.bookingCreatedAt.toISOString(),
      })),
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        replyCount: t.replyCount,
        createdAt: t.createdAt.toISOString(),
      })),
    });
    return;
  }

  if (user.role === "agency") {
    const agencyTreks = await db
      .select()
      .from(treksTable)
      .where(eq(treksTable.agencyId, user.id))
      .orderBy(desc(treksTable.createdAt));

    const activeCount = agencyTreks.filter((t) => t.status === "active").length;

    // Average rating across all bookings on this agency's treks
    const trekIds = agencyTreks.map((t) => t.id);
    let avgRating: number | null = null;
    if (trekIds.length > 0) {
      const { inArray, sql: rawSql } = await import("drizzle-orm");
      const [ratingRow] = await db
        .select({ avg: avg(bookingsTable.rating) })
        .from(bookingsTable)
        .where(and(inArray(bookingsTable.trekId, trekIds), eq(bookingsTable.status, "paid")));
      avgRating = ratingRow?.avg ? Number(Number(ratingRow.avg).toFixed(1)) : null;
    }

    res.json({
      ...base,
      avgRating,
      totalTreksListed: agencyTreks.length,
      activeTreks: agencyTreks
        .filter((t) => t.status === "active")
        .map((t) => ({
          id: t.id,
          title: t.title,
          destination: t.destination,
          duration: t.duration,
          price: Number(t.price),
          difficultyLevel: t.difficultyLevel,
          maxAltitudeMeters: t.maxAltitudeMeters ?? null,
          imageUrl: t.imageUrl ?? null,
          currentParticipants: t.currentParticipants,
          maxGroupSize: t.maxGroupSize,
          startDate: t.startDate,
          createdAt: t.createdAt.toISOString(),
        })),
    });
    return;
  }

  // Fallback for users without a role yet
  res.json(base);
});

export default router;
