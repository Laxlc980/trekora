// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, trekPricingSeasonsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

/** Nepal's standard 4 seasons with default multipliers */
const DEFAULT_SEASONS = [
  { seasonName: "Spring", startDate: "2024-03-01", endDate: "2024-05-31", priceMultiplier: "1.20", label: "peak" },
  { seasonName: "Monsoon", startDate: "2024-06-01", endDate: "2024-08-31", priceMultiplier: "0.80", label: "off-season" },
  { seasonName: "Autumn", startDate: "2024-09-01", endDate: "2024-11-30", priceMultiplier: "1.20", label: "peak" },
  { seasonName: "Winter", startDate: "2024-12-01", endDate: "2025-02-28", priceMultiplier: "1.00", label: "shoulder" },
];

/** Create default seasons for a trek */
export async function createDefaultSeasons(trekId: string) {
  await db.insert(trekPricingSeasonsTable).values(
    DEFAULT_SEASONS.map((s) => ({ ...s, trekId })),
  );
}

// GET /treks/:trekId/seasons — list seasons for a trek
router.get("/treks/:trekId/seasons", async (req: Request, res: Response) => {
  const seasons = await db.select().from(trekPricingSeasonsTable).where(eq(trekPricingSeasonsTable.trekId, req.params.trekId));
  res.json(seasons.map((s) => ({
    id: s.id, trekId: s.trekId, seasonName: s.seasonName,
    startDate: s.startDate, endDate: s.endDate,
    priceMultiplier: Number(s.priceMultiplier), label: s.label,
  })));
});

// PUT /treks/:trekId/seasons/:seasonId — update a season's multiplier/label
router.put("/treks/:trekId/seasons/:seasonId", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [season] = await db.select().from(trekPricingSeasonsTable).where(eq(trekPricingSeasonsTable.id, req.params.seasonId));
  if (!season || season.trekId !== req.params.trekId) { res.status(404).json({ error: "Season not found" }); return; }

  const { priceMultiplier, label, startDate, endDate } = req.body;
  const updates: Record<string, unknown> = {};
  if (priceMultiplier !== undefined) updates.priceMultiplier = String(priceMultiplier);
  if (label !== undefined) updates.label = label;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;

  const [updated] = await db.update(trekPricingSeasonsTable).set(updates).where(eq(trekPricingSeasonsTable.id, req.params.seasonId)).returning();
  res.json({ id: updated.id, trekId: updated.trekId, seasonName: updated.seasonName, startDate: updated.startDate, endDate: updated.endDate, priceMultiplier: Number(updated.priceMultiplier), label: updated.label });
});

export default router;
