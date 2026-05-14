import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createNotification } from "../lib/notify";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// POST /agencies/verification/apply — agency submits verification documents
// ---------------------------------------------------------------------------
router.post("/agencies/verification/apply", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (user?.role !== "agency") {
    res.status(403).json({ error: "Only agencies can apply for verification" });
    return;
  }

  if (user.verificationStatus === "verified") {
    res.status(400).json({ error: "Agency is already verified" });
    return;
  }

  const { ntbRegistrationNumber, licenseDocumentUrl } = req.body;
  if (!ntbRegistrationNumber?.trim() || !licenseDocumentUrl?.trim()) {
    res.status(400).json({ error: "ntbRegistrationNumber and licenseDocumentUrl are required" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      ntbRegistrationNumber: ntbRegistrationNumber.trim(),
      licenseDocumentUrl: licenseDocumentUrl.trim(),
      verificationStatus: "pending",
      verificationNote: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, req.user.id))
    .returning();

  res.json({
    verificationStatus: updated.verificationStatus,
    ntbRegistrationNumber: updated.ntbRegistrationNumber,
    licenseDocumentUrl: updated.licenseDocumentUrl,
  });
});

// ---------------------------------------------------------------------------
// GET /admin/verifications — admin only, list pending verifications
// ---------------------------------------------------------------------------
router.get("/admin/verifications", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [admin] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user.id));
  if (admin?.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }

  const pending = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      agencyName: usersTable.agencyName,
      ntbRegistrationNumber: usersTable.ntbRegistrationNumber,
      licenseDocumentUrl: usersTable.licenseDocumentUrl,
      verificationStatus: usersTable.verificationStatus,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.verificationStatus, "pending"));

  res.json(pending.map((u) => ({
    ...u,
    appliedAt: u.updatedAt.toISOString(),
  })));
});

// ---------------------------------------------------------------------------
// POST /admin/verifications/:userId/approve — admin approves
// ---------------------------------------------------------------------------
router.post("/admin/verifications/:userId/approve", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [admin] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user.id));
  if (admin?.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.userId));
  if (!user || user.verificationStatus !== "pending") {
    res.status(404).json({ error: "No pending verification found for this user" });
    return;
  }

  await db
    .update(usersTable)
    .set({ isVerified: true, verificationStatus: "verified", verificationNote: null, updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.userId));

  createNotification({
    userId: req.params.userId,
    title: "Agency Verified! ✓",
    message: "Your agency has been verified! Your profile now shows a verified badge. Trekkers can filter for verified agencies.",
    type: "join_accepted",
    actionUrl: "/dashboard",
  }).catch(() => {});

  res.json({ success: true, verificationStatus: "verified" });
});

// ---------------------------------------------------------------------------
// POST /admin/verifications/:userId/reject — admin rejects with note
// ---------------------------------------------------------------------------
router.post("/admin/verifications/:userId/reject", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [admin] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user.id));
  if (admin?.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }

  const { note } = req.body as { note?: string };
  if (!note?.trim()) {
    res.status(400).json({ error: "A rejection note is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.userId));
  if (!user || user.verificationStatus !== "pending") {
    res.status(404).json({ error: "No pending verification found for this user" });
    return;
  }

  await db
    .update(usersTable)
    .set({ isVerified: false, verificationStatus: "rejected", verificationNote: note.trim(), updatedAt: new Date() })
    .where(eq(usersTable.id, req.params.userId));

  createNotification({
    userId: req.params.userId,
    title: "Verification Not Approved",
    message: `Your agency verification was not approved. Reason: ${note.trim()}. You can resubmit with updated documents.`,
    type: "join_rejected",
    actionUrl: "/dashboard",
  }).catch(() => {});

  res.json({ success: true, verificationStatus: "rejected" });
});

export default router;
