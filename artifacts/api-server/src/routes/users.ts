import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SetUserRoleBody, UpdateMyProfileBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users/me", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    agencyName: user.agencyName,
    bio: user.bio,
    phone: user.phone,
    location: user.location,
    createdAt: user.createdAt.toISOString(),
  });
});

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
  const userId = req.user.id;
  const [updated] = await db
    .update(usersTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning();
  res.json({
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    profileImageUrl: updated.profileImageUrl,
    role: updated.role,
    agencyName: updated.agencyName,
    bio: updated.bio,
    phone: updated.phone,
    location: updated.location,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/users/me/role", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = SetUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const userId = req.user.id;
  const updateData: Record<string, unknown> = { role: parsed.data.role, updatedAt: new Date() };
  if (parsed.data.agencyName) {
    updateData.agencyName = parsed.data.agencyName;
  }
  const [updated] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, userId))
    .returning();
  res.json({
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    profileImageUrl: updated.profileImageUrl,
    role: updated.role,
    agencyName: updated.agencyName,
    bio: updated.bio,
    phone: updated.phone,
    location: updated.location,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
