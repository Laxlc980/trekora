import { Router, type IRouter, type Request, type Response } from "express";
import { db, treksTable, usersTable } from "@workspace/db";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { CreateTrekBody, UpdateTrekBody, ListTreksQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

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
  const params = ListTreksQueryParams.safeParse(req.query);
  const treks = await db
    .select()
    .from(treksTable)
    .where(eq(treksTable.status, "active"))
    .orderBy(desc(treksTable.createdAt));

  const agencyIds = [...new Set(treks.map((t) => t.agencyId))];
  const agencies = agencyIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, agencyIds))
    : [];
  const agencyMap = Object.fromEntries(agencies.map((a) => [a.id, a.agencyName ?? `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim()]));

  let result = treks.map((t) => formatTrek(t, agencyMap[t.agencyId]));

  if (params.success) {
    const { destination, minPrice, maxPrice, difficulty } = params.data;
    if (destination) result = result.filter((t) => t.destination.toLowerCase().includes(destination.toLowerCase()));
    if (minPrice !== undefined) result = result.filter((t) => t.price >= minPrice);
    if (maxPrice !== undefined) result = result.filter((t) => t.price <= maxPrice);
    if (difficulty) result = result.filter((t) => t.difficultyLevel === difficulty);
  }

  res.json(result);
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
  res.status(201).json(formatTrek(trek, user.agencyName));
});

router.get("/treks/:trekId", async (req: Request, res: Response) => {
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, req.params.trekId));
  if (!trek) {
    res.status(404).json({ error: "Trek not found" });
    return;
  }
  const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, trek.agencyId));
  res.json(formatTrek(trek, agency?.agencyName ?? `${agency?.firstName ?? ""} ${agency?.lastName ?? ""}`.trim()));
});

router.put("/treks/:trekId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, req.params.trekId));
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
    .where(eq(treksTable.id, req.params.trekId))
    .returning();
  const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, updated.agencyId));
  res.json(formatTrek(updated, agency?.agencyName));
});

router.delete("/treks/:trekId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [trek] = await db.select().from(treksTable).where(eq(treksTable.id, req.params.trekId));
  if (!trek || trek.agencyId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  await db.delete(treksTable).where(eq(treksTable.id, req.params.trekId));
  res.json({ success: true });
});

export default router;
