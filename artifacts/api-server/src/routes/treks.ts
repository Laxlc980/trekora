// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, treksTable, usersTable, trekPricingSeasonsTable, reviewsTable } from "@workspace/db";
import { eq, desc, sql, inArray, count, and, gte, lte, like, avg } from "drizzle-orm";
import { CreateTrekBody, UpdateTrekBody, ListTreksQueryParams } from "@workspace/api-zod";
import { createDefaultSeasons } from "./seasons.js";

const router: IRouter = Router();

function parsePagination(query: Record<string, unknown>): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function formatTrek(trek: typeof treksTable.$inferSelect, agencyName?: string | null) {
  return {
    id: trek.id,
    agencyId: trek.agencyId,
    agencyName: agencyName ?? null,
    title: trek.title,
    destination: trek.destination,
    duration: trek.duration,
    startDate: trek.startDate,
    endDate: trek.endDate ?? null,
    price: Number(trek.price),
    maxGroupSize: trek.maxGroupSize,
    description: trek.description,
    imageUrl: trek.imageUrl ?? null,
    status: trek.status as "active" | "cancelled" | "completed",
    currentParticipants: trek.currentParticipants,
    difficultyLevel: trek.difficultyLevel as "easy" | "moderate" | "hard" | "extreme",
    maxAltitudeMeters: trek.maxAltitudeMeters ?? null,
    createdAt: trek.createdAt.toISOString(),
  };
}

router.get("/treks/featured", async (req: Request, res: Response) => {
  const treks = await db
    .select()
    .from(treksTable)
    .where(eq(treksTable.status, "active"))
    .orderBy(desc(treksTable.currentParticipants))
    .limit(6);

  const agencyIds = [...new Set(treks.map((t) => t.agencyId))];
  const agencies = agencyIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, agencyIds))
    : [];
  const agencyMap = Object.fromEntries(agencies.map((a) => [a.id, a.agencyName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()]));

  res.json(treks.map((t) => formatTrek(t, agencyMap[t.agencyId])));
});

router.get("/destinations/popular", async (req: Request, res: Response) => {
  const results = await db.execute(
    sql`SELECT destination, COUNT(*)::int as "trekCount", AVG(price::numeric)::numeric(10,2) as "avgPrice"
        FROM treks WHERE status = 'active'
        GROUP BY destination ORDER BY COUNT(*) DESC LIMIT 10`
  );
  const rows = (results as unknown as { rows: Array<{ destination: string; trekCount: number; avgPrice: string }> }).rows;
  res.json(rows.map((r) => ({ destination: r.destination, trekCount: r.trekCount, avgPrice: Number(r.avgPrice) })));
});

router.get("/treks", async (req: Request, res: Response) => {
  const { page, limit, offset } = parsePagination(req.query);
  const params = ListTreksQueryParams.safeParse(req.query);
  const verifiedOnly = req.query.verifiedOnly === "true";

  // Build WHERE conditions in SQL so limit/offset operate on the filtered set
  const conditions = [eq(treksTable.status, "active")];
  if (params.success) {
    const { destination, minPrice, maxPrice, difficulty, maxAltitude } = params.data;
    if (destination) conditions.push(like(treksTable.destination, `%${destination}%`));
    if (minPrice !== undefined) conditions.push(gte(treksTable.price, String(minPrice)));
    if (maxPrice !== undefined) conditions.push(lte(treksTable.price, String(maxPrice)));
    if (difficulty) conditions.push(eq(treksTable.difficultyLevel, difficulty));
    if (maxAltitude !== undefined) conditions.push(lte(treksTable.maxAltitudeMeters, maxAltitude));
  }

  // If verifiedOnly, restrict to treks from verified agencies
  if (verifiedOnly) {
    const verifiedAgencies = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.isVerified, true));
    const verifiedIds = verifiedAgencies.map((a) => a.id);
    if (verifiedIds.length > 0) {
      conditions.push(inArray(treksTable.agencyId, verifiedIds));
    } else {
      // No verified agencies — return empty
      res.json({ data: [], pagination: { page, limit, total: 0, hasMore: false } });
      return;
    }
  }

  const where = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(treksTable)
    .where(where);

  const treks = await db
    .select()
    .from(treksTable)
    .where(where)
    .orderBy(desc(treksTable.createdAt))
    .limit(limit)
    .offset(offset);

  const agencyIds = [...new Set(treks.map((t) => t.agencyId))];
  const agencies = agencyIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, agencyIds))
    : [];
  const agencyMap = Object.fromEntries(agencies.map((a) => [a.id, { name: a.agencyName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(), isVerified: a.isVerified }]));

  // Fetch review stats for all treks in this page
  const trekIds = treks.map((t) => t.id);
  const reviewStats = trekIds.length > 0
    ? await db
        .select({
          trekId: reviewsTable.trekId,
          avgRating: avg(reviewsTable.rating),
          reviewCount: count(),
        })
        .from(reviewsTable)
        .where(inArray(reviewsTable.trekId, trekIds))
        .groupBy(reviewsTable.trekId)
    : [];
  const reviewMap = Object.fromEntries(
    reviewStats.map((r) => [r.trekId, { averageRating: r.avgRating ? Number(Number(r.avgRating).toFixed(1)) : null, reviewCount: r.reviewCount }]),
  );

  res.json({
    data: treks.map((t) => ({
      ...formatTrek(t, agencyMap[t.agencyId]?.name),
      isAgencyVerified: agencyMap[t.agencyId]?.isVerified ?? false,
      averageRating: reviewMap[t.id]?.averageRating ?? null,
      reviewCount: reviewMap[t.id]?.reviewCount ?? 0,
    })),
    pagination: { page, limit, total, hasMore: offset + treks.length < total },
  });
});

router.post("/treks", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (user?.role !== "agency") {
    res.status(403).json({ error: "Only agencies can create treks" });
    return;
  }
  const parsed = CreateTrekBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error });
    return;
  }
  const [trek] = await db
    .insert(treksTable)
    .values({ ...parsed.data, agencyId: req.user.id, price: String(parsed.data.price) })
    .returning();

  // Auto-create Nepal's 4 standard pricing seasons for the new trek
  createDefaultSeasons(trek.id).catch(() => {});

  res.status(201).json(formatTrek(trek, user.agencyName));
});

router.get("/treks/:trekId", async (req: Request, res: Response) => {
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, String(req.params.trekId)));
  if (!trek) {
    res.status(404).json({ error: "Trek not found" });
    return;
  }
  const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, trek.agencyId));

  // Determine current season and adjusted price
  const seasons = await db.select().from(trekPricingSeasonsTable).where(eq(trekPricingSeasonsTable.trekId, trek.id));
  let currentSeasonLabel: string | null = null;
  let adjustedPrice = Number(trek.price);

  if (seasons.length > 0) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    for (const s of seasons) {
      const startMonth = new Date(s.startDate).getMonth() + 1;
      const endMonth = new Date(s.endDate).getMonth() + 1;
      // Handle wrap-around (e.g. Dec-Feb)
      const inSeason = startMonth <= endMonth
        ? currentMonth >= startMonth && currentMonth <= endMonth
        : currentMonth >= startMonth || currentMonth <= endMonth;
      if (inSeason) {
        currentSeasonLabel = s.label;
        adjustedPrice = Math.round(Number(trek.price) * Number(s.priceMultiplier));
        break;
      }
    }
  }

  // Review stats for this trek
  const [reviewStats] = await db
    .select({ avgRating: avg(reviewsTable.rating), reviewCount: count() })
    .from(reviewsTable)
    .where(eq(reviewsTable.trekId, trek.id));

  res.json({
    ...formatTrek(trek, agency?.agencyName ?? `${agency?.firstName ?? ""} ${agency?.lastName ?? ""}`.trim()),
    currentSeasonLabel,
    adjustedPrice,
    averageRating: reviewStats.avgRating ? Number(Number(reviewStats.avgRating).toFixed(1)) : null,
    reviewCount: reviewStats.reviewCount,
  });
});

router.put("/treks/:trekId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, String(req.params.trekId)));
  if (!trek) {
    res.status(404).json({ error: "Trek not found" });
    return;
  }
  if (trek.agencyId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = UpdateTrekBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.price !== undefined) updateData.price = String(parsed.data.price);
  const [updated] = await db
    .update(treksTable)
    .set(updateData)
    .where(eq(treksTable.id, String(req.params.trekId)))
    .returning();
  const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, updated.agencyId));
  res.json(formatTrek(updated, agency?.agencyName));
});

router.delete("/treks/:trekId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, String(req.params.trekId)));
  if (!trek || trek.agencyId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(treksTable).where(eq(treksTable.id, String(req.params.trekId)));
  res.json({ success: true });
});

router.get("/agencies/:agencyId", async (req: Request, res: Response) => {
  const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, String(req.params.agencyId)));
  if (!agency || agency.role !== "agency") {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  const agencyTreks = await db
    .select()
    .from(treksTable)
    .where(eq(treksTable.agencyId, String(req.params.agencyId)));
  res.json({
    id: agency.id,
    agencyName: agency.agencyName,
    firstName: agency.firstName,
    lastName: agency.lastName,
    profileImageUrl: agency.profileImageUrl,
    bio: agency.bio,
    phone: agency.phone,
    location: agency.location,
    createdAt: agency.createdAt.toISOString(),
    treks: agencyTreks.map((t) => formatTrek(t, agency.agencyName)),
  });
});

export default router;
