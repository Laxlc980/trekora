// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, emergencyContactsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/emergency-contacts", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const contacts = await db.select().from(emergencyContactsTable).where(eq(emergencyContactsTable.userId, req.user.id));
  res.json(contacts.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/emergency-contacts", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { name, relationship, phone, email, isPrimary } = req.body;
  if (!name || !relationship || !phone) {
    res.status(400).json({ error: "name, relationship, and phone are required" }); return;
  }

  // Max 3 per user
  const existing = await db.select({ id: emergencyContactsTable.id }).from(emergencyContactsTable).where(eq(emergencyContactsTable.userId, req.user.id));
  if (existing.length >= 3) {
    res.status(409).json({ error: "Maximum 3 emergency contacts allowed" }); return;
  }

  // If marking as primary, unset others
  if (isPrimary) {
    await db.update(emergencyContactsTable).set({ isPrimary: false }).where(eq(emergencyContactsTable.userId, req.user.id));
  }

  const [contact] = await db.insert(emergencyContactsTable).values({
    userId: req.user.id, name, relationship, phone, email: email ?? null, isPrimary: isPrimary ?? false,
  }).returning();

  res.status(201).json({ ...contact, createdAt: contact.createdAt.toISOString() });
});

router.put("/emergency-contacts/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [existing] = await db.select().from(emergencyContactsTable).where(and(eq(emergencyContactsTable.id, req.params.id), eq(emergencyContactsTable.userId, req.user.id)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const { name, relationship, phone, email, isPrimary } = req.body;
  if (isPrimary) {
    await db.update(emergencyContactsTable).set({ isPrimary: false }).where(eq(emergencyContactsTable.userId, req.user.id));
  }

  const [updated] = await db.update(emergencyContactsTable).set({
    name: name ?? existing.name, relationship: relationship ?? existing.relationship,
    phone: phone ?? existing.phone, email: email !== undefined ? email : existing.email,
    isPrimary: isPrimary ?? existing.isPrimary,
  }).where(eq(emergencyContactsTable.id, req.params.id)).returning();

  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

router.delete("/emergency-contacts/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [existing] = await db.select().from(emergencyContactsTable).where(and(eq(emergencyContactsTable.id, req.params.id), eq(emergencyContactsTable.userId, req.user.id)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(emergencyContactsTable).where(eq(emergencyContactsTable.id, req.params.id));
  res.json({ success: true });
});

export default router;
