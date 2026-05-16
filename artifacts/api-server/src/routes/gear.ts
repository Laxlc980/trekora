// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, gearRentalsTable, secondhandGearTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

// ======================== GEAR RENTALS (Agency only) ========================

router.get("/gear-rentals", async (_req: Request, res: Response) => {
  const items = await db.select().from(gearRentalsTable).where(eq(gearRentalsTable.available, true)).orderBy(desc(gearRentalsTable.createdAt));
  const agencyIds = [...new Set(items.map((i) => i.agencyId))];
  const agencies = agencyIds.length > 0 ? await db.select().from(usersTable).where(eq(usersTable.role, "agency")) : [];
  const agencyMap = Object.fromEntries(agencies.map((a) => [a.id, a.agencyName ?? a.firstName]));
  res.json(items.map((i) => ({ ...i, pricePerDay: Number(i.pricePerDay), depositAmount: Number(i.depositAmount), agencyName: agencyMap[i.agencyId] ?? null, createdAt: i.createdAt.toISOString() })));
});

router.post("/gear-rentals", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (user?.role !== "agency") { res.status(403).json({ error: "Only agencies can list rental gear" }); return; }

  const { itemName, description, pricePerDay, depositAmount, imageUrl, category } = req.body;
  if (!itemName || !pricePerDay || !category) { res.status(400).json({ error: "itemName, pricePerDay, category required" }); return; }

  const [item] = await db.insert(gearRentalsTable).values({
    agencyId: req.user.id, itemName, description: description ?? null,
    pricePerDay: String(pricePerDay), depositAmount: String(depositAmount ?? 0),
    imageUrl: imageUrl ?? null, category,
  }).returning();
  res.status(201).json({ ...item, pricePerDay: Number(item.pricePerDay), depositAmount: Number(item.depositAmount), createdAt: item.createdAt.toISOString() });
});

router.put("/gear-rentals/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [item] = await db.select().from(gearRentalsTable).where(eq(gearRentalsTable.id, String(req.params.id)));
  if (!item || item.agencyId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const updates: Record<string, unknown> = {};
  const { itemName, description, pricePerDay, depositAmount, available, imageUrl, category } = req.body;
  if (itemName !== undefined) updates.itemName = itemName;
  if (description !== undefined) updates.description = description;
  if (pricePerDay !== undefined) updates.pricePerDay = String(pricePerDay);
  if (depositAmount !== undefined) updates.depositAmount = String(depositAmount);
  if (available !== undefined) updates.available = available;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (category !== undefined) updates.category = category;

  const [updated] = await db.update(gearRentalsTable).set(updates).where(eq(gearRentalsTable.id, String(req.params.id))).returning();
  res.json({ ...updated, pricePerDay: Number(updated.pricePerDay), depositAmount: Number(updated.depositAmount), createdAt: updated.createdAt.toISOString() });
});

router.delete("/gear-rentals/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [item] = await db.select().from(gearRentalsTable).where(eq(gearRentalsTable.id, String(req.params.id)));
  if (!item || item.agencyId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(gearRentalsTable).where(eq(gearRentalsTable.id, String(req.params.id)));
  res.json({ success: true });
});

// ======================== SECONDHAND GEAR (Any user) ========================

router.get("/secondhand", async (_req: Request, res: Response) => {
  const items = await db.select().from(secondhandGearTable).where(eq(secondhandGearTable.sold, false)).orderBy(desc(secondhandGearTable.createdAt));
  const sellerIds = [...new Set(items.map((i) => i.sellerId))];
  const sellers = sellerIds.length > 0 ? await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable) : [];
  const sellerMap = Object.fromEntries(sellers.map((s) => [s.id, s.username]));
  res.json(items.map((i) => ({ ...i, priceNPR: Number(i.priceNPR), sellerUsername: sellerMap[i.sellerId] ?? null, createdAt: i.createdAt.toISOString() })));
});

router.post("/secondhand", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { title, description, priceNPR, condition, imageUrl, category, location, contactPreference } = req.body;
  if (!title || !priceNPR || !condition || !category) { res.status(400).json({ error: "title, priceNPR, condition, category required" }); return; }

  const [item] = await db.insert(secondhandGearTable).values({
    sellerId: req.user.id, title, description: description ?? null,
    priceNPR: String(priceNPR), condition, imageUrl: imageUrl ?? null,
    category, location: location ?? null, contactPreference: contactPreference ?? "dm",
  }).returning();
  res.status(201).json({ ...item, priceNPR: Number(item.priceNPR), createdAt: item.createdAt.toISOString() });
});

router.put("/secondhand/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [item] = await db.select().from(secondhandGearTable).where(eq(secondhandGearTable.id, String(req.params.id)));
  if (!item || item.sellerId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const updates: Record<string, unknown> = {};
  const { title, description, priceNPR, condition, imageUrl, category, location, contactPreference } = req.body;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (priceNPR !== undefined) updates.priceNPR = String(priceNPR);
  if (condition !== undefined) updates.condition = condition;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;
  if (category !== undefined) updates.category = category;
  if (location !== undefined) updates.location = location;
  if (contactPreference !== undefined) updates.contactPreference = contactPreference;

  const [updated] = await db.update(secondhandGearTable).set(updates).where(eq(secondhandGearTable.id, String(req.params.id))).returning();
  res.json({ ...updated, priceNPR: Number(updated.priceNPR), createdAt: updated.createdAt.toISOString() });
});

router.delete("/secondhand/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [item] = await db.select().from(secondhandGearTable).where(eq(secondhandGearTable.id, String(req.params.id)));
  if (!item || item.sellerId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(secondhandGearTable).where(eq(secondhandGearTable.id, String(req.params.id)));
  res.json({ success: true });
});

router.post("/secondhand/:id/mark-sold", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [item] = await db.select().from(secondhandGearTable).where(eq(secondhandGearTable.id, String(req.params.id)));
  if (!item || item.sellerId !== req.user.id) { res.status(403).json({ error: "Forbidden" }); return; }
  const [updated] = await db.update(secondhandGearTable).set({ sold: true }).where(eq(secondhandGearTable.id, String(req.params.id))).returning();
  res.json({ ...updated, priceNPR: Number(updated.priceNPR), createdAt: updated.createdAt.toISOString() });
});

export default router;
