// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, bidsTable, customRequestsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateBidBody, RejectBidBody } from "@workspace/api-zod";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

async function formatBid(bid: typeof bidsTable.$inferSelect) {
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
    rejectionMessage: bid.rejectionMessage ?? null,
    createdAt: bid.createdAt.toISOString(),
  };
}

router.get("/custom-requests/:requestId/bids", async (req: Request, res: Response) => {
  const bids = await db.select().from(bidsTable).where(eq(bidsTable.customRequestId, req.params.requestId));
  const formatted = await Promise.all(bids.map(formatBid));
  res.json(formatted);
});

router.post("/custom-requests/:requestId/bids", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (user?.role !== "agency") {
    res.status(403).json({ error: "Only agencies can submit bids" });
    return;
  }
  const parsed = CreateBidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [cr] = await db.select().from(customRequestsTable).where(eq(customRequestsTable.id, req.params.requestId));
  if (!cr || cr.status !== "open") {
    res.status(400).json({ error: "Custom request is not open for bids" });
    return;
  }
  const [bid] = await db
    .insert(bidsTable)
    .values({
      customRequestId: req.params.requestId,
      agencyId: req.user.id,
      proposedPrice: String(parsed.data.proposedPrice),
      planDescription: parsed.data.planDescription,
      message: parsed.data.message ?? null,
      status: "pending",
    })
    .returning();

  const agencyDisplayName = (user.agencyName ?? (`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim())) || "An agency";
  createNotification({
    userId: cr.trekkerId,
    title: "New Bid on Your Request",
    message: `${agencyDisplayName} placed a bid of $${parsed.data.proposedPrice} on your trip to ${cr.destination}. View it in your dashboard.`,
    type: "bid_received",
    actionUrl: `/custom-requests/${req.params.requestId}`,
  }).catch(() => {});

  res.status(201).json(await formatBid(bid));
});

router.post("/bids/:bidId/select", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [bid] = await db.select().from(bidsTable).where(eq(bidsTable.id, req.params.bidId));
  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }
  const [cr] = await db.select().from(customRequestsTable).where(eq(customRequestsTable.id, bid.customRequestId));
  if (!cr || cr.trekkerId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [selectedBid] = await db
    .update(bidsTable)
    .set({ status: "selected", updatedAt: new Date() })
    .where(eq(bidsTable.id, req.params.bidId))
    .returning();
  await db
    .update(customRequestsTable)
    .set({ status: "closed", selectedBidId: req.params.bidId, updatedAt: new Date() })
    .where(eq(customRequestsTable.id, bid.customRequestId));

  createNotification({
    userId: bid.agencyId,
    title: "Your Bid Was Selected!",
    message: `A trekker has selected your bid for the trip to ${cr.destination}. Check your dashboard for next steps.`,
    type: "bid_selected",
    actionUrl: `/dashboard`,
  }).catch(() => {});

  res.json(await formatBid(selectedBid));
});

router.post("/bids/:bidId/reject", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = RejectBidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const [bid] = await db.select().from(bidsTable).where(eq(bidsTable.id, req.params.bidId));
  if (!bid) {
    res.status(404).json({ error: "Bid not found" });
    return;
  }
  if (bid.status !== "pending") {
    res.status(409).json({ error: "Only pending bids can be rejected" });
    return;
  }

  const [cr] = await db
    .select()
    .from(customRequestsTable)
    .where(eq(customRequestsTable.id, bid.customRequestId));
  if (!cr || cr.trekkerId !== req.user.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [rejected] = await db
    .update(bidsTable)
    .set({ status: "rejected", rejectionMessage: parsed.data.message, updatedAt: new Date() })
    .where(eq(bidsTable.id, req.params.bidId))
    .returning();

  createNotification({
    userId: bid.agencyId,
    title: "Bid Not Selected",
    message: `Your bid for the trip to ${cr.destination} was not selected. Reason: ${parsed.data.message}`,
    type: "bid_received",
    actionUrl: `/dashboard`,
  }).catch(() => {});

  res.json(await formatBid(rejected));
});

export default router;
