import { Router, type IRouter, type Request, type Response } from "express";
import { db, customRequestsTable, bidsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCustomRequestBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function formatCustomRequest(cr: typeof customRequestsTable.$inferSelect) {
  const [trekker] = await db.select().from(usersTable).where(eq(usersTable.id, cr.trekkerId));
  const bidsCountResult = await db.execute(
    sql`SELECT COUNT(*)::int as count FROM bids WHERE custom_request_id = ${cr.id}`
  );
  const bidsCount = (bidsCountResult as unknown as { rows: Array<{ count: number }> }).rows[0]?.count ?? 0;
  return {
    id: cr.id,
    trekkerId: cr.trekkerId,
    trekkerName: trekker ? `${trekker.firstName ?? ""} ${trekker.lastName ?? ""}`.trim() || trekker.email : null,
    destination: cr.destination,
    budget: Number(cr.budget),
    startDate: cr.startDate,
    endDate: cr.endDate ?? null,
    groupSize: cr.groupSize,
    notes: cr.notes ?? null,
    status: cr.status as "open" | "closed" | "cancelled",
    bidsCount,
    selectedBidId: cr.selectedBidId ?? null,
    createdAt: cr.createdAt.toISOString(),
  };
}

router.get("/custom-requests", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  let requests: (typeof customRequestsTable.$inferSelect)[];
  if (user?.role === "agency") {
    requests = await db
      .select()
      .from(customRequestsTable)
      .where(eq(customRequestsTable.status, "open"))
      .orderBy(sql`${customRequestsTable.createdAt} DESC`);
  } else {
    requests = await db
      .select()
      .from(customRequestsTable)
      .where(eq(customRequestsTable.trekkerId, req.user.id))
      .orderBy(sql`${customRequestsTable.createdAt} DESC`);
  }
  const formatted = await Promise.all(requests.map(formatCustomRequest));
  res.json(formatted);
});

router.post("/custom-requests", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateCustomRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error });
    return;
  }
  const [cr] = await db
    .insert(customRequestsTable)
    .values({
      ...parsed.data,
      trekkerId: req.user.id,
      budget: String(parsed.data.budget),
      groupSize: parsed.data.groupSize ?? 1,
      status: "open",
    })
    .returning();
  res.status(201).json(await formatCustomRequest(cr));
});

router.get("/custom-requests/:requestId", async (req: Request, res: Response) => {
  const [cr] = await db.select().from(customRequestsTable).where(eq(customRequestsTable.id, req.params.requestId));
  if (!cr) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Fetch all bids for this custom request (if trekker is viewing)
  let bidsData: Record<string, unknown>[] = [];
  if (req.isAuthenticated() && cr.trekkerId === req.user.id) {
    const bids = await db.select().from(bidsTable).where(eq(bidsTable.customRequestId, cr.id));
    const formatBid = async (bid: typeof bidsTable.$inferSelect) => {
      const [agency] = await db.select().from(usersTable).where(eq(usersTable.id, bid.agencyId));
      return {
        id: bid.id,
        customRequestId: bid.customRequestId,
        agencyId: bid.agencyId,
        agencyName: agency?.agencyName ?? (`${agency?.firstName ?? ""} ${agency?.lastName ?? ""}`.trim() || null),
        agencyProfileImage: agency?.profileImageUrl ?? null,
        proposedPrice: Number(bid.proposedPrice),
        planDescription: bid.planDescription,
        message: bid.message ?? null,
        status: bid.status as "pending" | "selected" | "rejected",
        createdAt: bid.createdAt.toISOString(),
      };
    };
    bidsData = await Promise.all(bids.map(formatBid));
  }

  const formatted = await formatCustomRequest(cr);
  res.json({ ...formatted, bids: bidsData });
});

export default router;
