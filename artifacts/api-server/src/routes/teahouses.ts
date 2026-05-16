// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, teahousesTable, checkinsTable, usersTable, bookingsTable, treksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

// GET /teahouses?destination=xxx
router.get("/teahouses", async (req: Request, res: Response) => {
  const destination = (req.query.destination as string)?.trim();
  if (!destination) { res.status(400).json({ error: "destination query parameter required" }); return; }

  const teahouses = await db.select().from(teahousesTable).where(eq(teahousesTable.destination, destination));
  res.json(teahouses.map((t) => ({
    ...t,
    altitude: t.altitude,
    latitude: t.latitude ? Number(t.latitude) : null,
    longitude: t.longitude ? Number(t.longitude) : null,
    facilities: t.facilities ? JSON.parse(t.facilities) : [],
    createdAt: t.createdAt.toISOString(),
  })));
});

// POST /checkins — trekker checks in (must have active booking for destination)
router.post("/checkins", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { teahouseId, note, trailCondition, isPublic } = req.body;
  if (!teahouseId) { res.status(400).json({ error: "teahouseId required" }); return; }

  const [teahouse] = await db.select().from(teahousesTable).where(eq(teahousesTable.id, teahouseId));
  if (!teahouse) { res.status(404).json({ error: "Teahouse not found" }); return; }

  // Verify trekker has an active booking for this destination
  const bookings = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .leftJoin(treksTable, eq(bookingsTable.trekId, treksTable.id))
    .where(and(eq(bookingsTable.trekkerId, req.user.id), eq(bookingsTable.status, "paid"), eq(treksTable.destination, teahouse.destination)));

  if (bookings.length === 0) {
    res.status(403).json({ error: "You need an active booking for this destination to check in" }); return;
  }

  const today = new Date().toISOString().split("T")[0];
  const [checkin] = await db.insert(checkinsTable).values({
    userId: req.user.id, teahouseId, checkinDate: today,
    note: note ?? null, trailCondition: trailCondition ?? "clear", isPublic: isPublic ?? true,
  }).returning();

  res.status(201).json({ ...checkin, createdAt: checkin.createdAt.toISOString() });
});

// GET /checkins/trail/:destination — public feed of recent check-ins
router.get("/checkins/trail/:destination", async (req: Request, res: Response) => {
  const destination = String(req.params.destination);

  const teahouses = await db.select({ id: teahousesTable.id }).from(teahousesTable).where(eq(teahousesTable.destination, destination));
  if (teahouses.length === 0) { res.json([]); return; }

  const { inArray } = await import("drizzle-orm");
  const teahouseIds = teahouses.map((t) => t.id);

  const checkins = await db
    .select({
      id: checkinsTable.id,
      userId: checkinsTable.userId,
      teahouseId: checkinsTable.teahouseId,
      checkinDate: checkinsTable.checkinDate,
      note: checkinsTable.note,
      trailCondition: checkinsTable.trailCondition,
      createdAt: checkinsTable.createdAt,
      teahouseName: teahousesTable.name,
      teahouseAltitude: teahousesTable.altitude,
      username: usersTable.username,
    })
    .from(checkinsTable)
    .leftJoin(teahousesTable, eq(checkinsTable.teahouseId, teahousesTable.id))
    .leftJoin(usersTable, eq(checkinsTable.userId, usersTable.id))
    .where(and(inArray(checkinsTable.teahouseId, teahouseIds), eq(checkinsTable.isPublic, true)))
    .orderBy(desc(checkinsTable.createdAt))
    .limit(30);

  res.json(checkins.map((c) => ({
    id: c.id,
    username: c.username ? `@${c.username}` : "Anonymous",
    teahouseName: c.teahouseName,
    teahouseAltitude: c.teahouseAltitude,
    checkinDate: c.checkinDate,
    note: c.note,
    trailCondition: c.trailCondition,
    createdAt: c.createdAt.toISOString(),
  })));
});

// GET /checkins/me — my check-in history
router.get("/checkins/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const checkins = await db
    .select({
      id: checkinsTable.id,
      teahouseId: checkinsTable.teahouseId,
      checkinDate: checkinsTable.checkinDate,
      note: checkinsTable.note,
      trailCondition: checkinsTable.trailCondition,
      isPublic: checkinsTable.isPublic,
      createdAt: checkinsTable.createdAt,
      teahouseName: teahousesTable.name,
      teahouseAltitude: teahousesTable.altitude,
      teahouseDestination: teahousesTable.destination,
    })
    .from(checkinsTable)
    .leftJoin(teahousesTable, eq(checkinsTable.teahouseId, teahousesTable.id))
    .where(eq(checkinsTable.userId, req.user.id))
    .orderBy(desc(checkinsTable.createdAt));

  res.json(checkins.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  })));
});

export default router;
