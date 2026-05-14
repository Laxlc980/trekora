import { Router, type IRouter, type Request, type Response } from "express";
import { db, sosAlertsTable, bookingsTable, treksTable, usersTable, emergencyContactsTable } from "@workspace/db";
import { eq, and, desc, lte, gte } from "drizzle-orm";
import { createNotification } from "../lib/notify";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Twilio helper — lazy-loaded, gracefully skips if not configured
// ---------------------------------------------------------------------------
function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return null;
  try {
    // Dynamic import to avoid crash if twilio isn't installed
    const twilio = require("twilio");
    return { client: twilio(sid, token), from };
  } catch {
    return null;
  }
}

async function sendSms(to: string, body: string) {
  const tw = getTwilioClient();
  if (!tw) return;
  try {
    await tw.client.messages.create({ to, from: tw.from, body });
  } catch (err) {
    logger.warn({ err, to }, "Failed to send SMS");
  }
}

// ---------------------------------------------------------------------------
// POST /sos — trigger emergency alert
// ---------------------------------------------------------------------------
router.post("/sos", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { latitude, longitude } = req.body as { latitude?: number; longitude?: number };

  // 1. Find active booking (today between trek startDate and endDate)
  const today = new Date().toISOString().split("T")[0];

  const activeBookings = await db
    .select({
      bookingId: bookingsTable.id,
      trekId: treksTable.id,
      trekName: treksTable.title,
      destination: treksTable.destination,
      agencyId: treksTable.agencyId,
      startDate: treksTable.startDate,
      endDate: treksTable.endDate,
    })
    .from(bookingsTable)
    .innerJoin(treksTable, eq(bookingsTable.trekId, treksTable.id))
    .where(and(
      eq(bookingsTable.trekkerId, req.user.id),
      eq(bookingsTable.status, "paid"),
      lte(treksTable.startDate, today),
    ));

  // Filter to bookings where endDate (or startDate + duration) >= today
  const activeBooking = activeBookings.find((b) => {
    const end = b.endDate ?? b.startDate;
    return end >= today;
  });

  if (!activeBooking) {
    res.status(400).json({ error: "No active booking found. SOS is only available during an active trek." });
    return;
  }

  // Get agency details
  const [agency] = await db
    .select({ agencyName: usersTable.agencyName, phone: usersTable.phone, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, activeBooking.agencyId));

  // Get trekker details
  const [trekker] = await db
    .select({ username: usersTable.username, email: usersTable.email, phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  const trekkerName = trekker?.username ? `@${trekker.username}` : "A trekker";
  const agencyName = agency?.agencyName ?? "Unknown Agency";
  const agencyPhone = agency?.phone ?? "N/A";
  const triggeredAt = new Date();
  const timeStr = triggeredAt.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  // 2. Log the alert
  const [alert] = await db
    .insert(sosAlertsTable)
    .values({
      userId: req.user.id,
      bookingId: activeBooking.bookingId,
      trekName: activeBooking.trekName,
      agencyName,
      agencyPhone,
      lastKnownDestination: activeBooking.destination,
      latitude: latitude != null ? String(latitude) : null,
      longitude: longitude != null ? String(longitude) : null,
      triggeredAt,
    })
    .returning();

  // 3. Fetch emergency contacts
  const contacts = await db
    .select()
    .from(emergencyContactsTable)
    .where(eq(emergencyContactsTable.userId, req.user.id));

  // Build message
  const mapsLink = latitude != null && longitude != null
    ? `https://maps.google.com/?q=${latitude},${longitude}`
    : null;

  const smsMessage = `URGENT: ${trekkerName} has triggered an SOS alert while trekking ${activeBooking.trekName} with ${agencyName}. Last known location: ${activeBooking.destination}. Agency contact: ${agencyPhone}. Triggered at: ${timeStr}. Please try to contact them immediately.`;

  const emailHtml = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
      <div style="background:#dc2626;color:white;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:20px;">🚨 SOS Emergency Alert</h2>
      </div>
      <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
        <p style="font-size:15px;line-height:1.6;"><strong>${trekkerName}</strong> has triggered an emergency SOS alert.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:8px 0;color:#6b7280;">Trek</td><td style="padding:8px 0;font-weight:600;">${activeBooking.trekName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Agency</td><td style="padding:8px 0;">${agencyName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Agency Phone</td><td style="padding:8px 0;">${agencyPhone}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Location</td><td style="padding:8px 0;">${activeBooking.destination}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Triggered</td><td style="padding:8px 0;">${timeStr}</td></tr>
        </table>
        ${mapsLink ? `<p><a href="${mapsLink}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600;">View on Google Maps</a></p>` : ""}
        <p style="margin-top:24px;font-size:13px;color:#6b7280;">Please try to contact them immediately. If you cannot reach them, contact the agency or local emergency services.</p>
      </div>
    </div>`;

  // 4. Send SMS and email to each emergency contact
  for (const contact of contacts) {
    sendSms(contact.phone, smsMessage);
    if (contact.email) {
      sendEmail({
        to: contact.email,
        subject: `🚨 SOS Alert from ${trekkerName}`,
        text: smsMessage + (mapsLink ? `\n\nGoogle Maps: ${mapsLink}` : ""),
        html: emailHtml,
      }).catch(() => {});
    }
  }

  // 5. Notify the agency in-app
  createNotification({
    userId: activeBooking.agencyId,
    title: "🚨 SOS Alert — Trekker Emergency",
    message: `${trekkerName} has triggered an SOS alert on ${activeBooking.trekName} (${activeBooking.destination}). Please attempt contact immediately.`,
    type: "join_accepted",
    actionUrl: "/dashboard",
  }).catch(() => {});

  // 6. Confirmation to trekker
  if (trekker?.phone) {
    sendSms(trekker.phone, `Your SOS alert has been sent. Your emergency contacts and agency (${agencyName}, ${agencyPhone}) have been notified. Stay calm and stay where you are if possible.`);
  }
  if (trekker?.email) {
    sendEmail({
      to: trekker.email,
      subject: "SOS Alert Confirmed — Help is on the way",
      text: `Your SOS alert has been sent successfully. Your emergency contacts and agency (${agencyName}) have been notified. Stay calm and stay where you are if possible.`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;"><h2>SOS Alert Sent ✓</h2><p>Your emergency contacts and agency (<strong>${agencyName}</strong>) have been notified.</p><p>Stay calm and stay where you are if possible. Help is on the way.</p></div>`,
    }).catch(() => {});
  }

  res.status(201).json({
    id: alert.id,
    message: "SOS alert sent successfully. Your emergency contacts and agency have been notified.",
    triggeredAt: alert.triggeredAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// GET /sos/active — check if trekker has an active booking (for SOS button visibility)
// ---------------------------------------------------------------------------
router.get("/sos/active", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({ hasActiveBooking: false });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const activeBookings = await db
    .select({ id: bookingsTable.id, endDate: treksTable.endDate, startDate: treksTable.startDate })
    .from(bookingsTable)
    .innerJoin(treksTable, eq(bookingsTable.trekId, treksTable.id))
    .where(and(
      eq(bookingsTable.trekkerId, req.user.id),
      eq(bookingsTable.status, "paid"),
      lte(treksTable.startDate, today),
    ));

  const hasActive = activeBookings.some((b) => {
    const end = b.endDate ?? b.startDate;
    return end >= today;
  });

  res.json({ hasActiveBooking: hasActive });
});

// ---------------------------------------------------------------------------
// GET /admin/sos-alerts — admin only, list all alerts
// ---------------------------------------------------------------------------
router.get("/admin/sos-alerts", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [admin] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user.id));
  if (admin?.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }

  const alerts = await db
    .select({
      id: sosAlertsTable.id,
      userId: sosAlertsTable.userId,
      trekName: sosAlertsTable.trekName,
      lastKnownDestination: sosAlertsTable.lastKnownDestination,
      latitude: sosAlertsTable.latitude,
      longitude: sosAlertsTable.longitude,
      triggeredAt: sosAlertsTable.triggeredAt,
      resolved: sosAlertsTable.resolved,
      resolvedAt: sosAlertsTable.resolvedAt,
      username: usersTable.username,
    })
    .from(sosAlertsTable)
    .leftJoin(usersTable, eq(sosAlertsTable.userId, usersTable.id))
    .orderBy(desc(sosAlertsTable.triggeredAt));

  res.json(alerts.map((a) => ({
    ...a,
    username: a.username ? `@${a.username}` : "Unknown",
    latitude: a.latitude ? Number(a.latitude) : null,
    longitude: a.longitude ? Number(a.longitude) : null,
    triggeredAt: a.triggeredAt.toISOString(),
    resolvedAt: a.resolvedAt?.toISOString() ?? null,
  })));
});

// ---------------------------------------------------------------------------
// POST /admin/sos-alerts/:id/resolve — admin marks alert as resolved
// ---------------------------------------------------------------------------
router.post("/admin/sos-alerts/:id/resolve", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [admin] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.user.id));
  if (admin?.role !== "admin") {
    res.status(403).json({ error: "Forbidden — admin access required" });
    return;
  }

  const [updated] = await db
    .update(sosAlertsTable)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(eq(sosAlertsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }

  res.json({ success: true, resolvedAt: updated.resolvedAt?.toISOString() });
});

export default router;
