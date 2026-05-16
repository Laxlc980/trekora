// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, permitTypesTable, userPermitsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function getAppOrigin(): string {
  const base = (process.env.ALLOWED_ORIGIN ?? process.env.BASE_PATH ?? "").split(",")[0].trim();
  return base || "http://localhost:8081";
}

// ---------------------------------------------------------------------------
// GET /permits?destination=xxx — list required permits for a destination
// ---------------------------------------------------------------------------
router.get("/permits", async (req: Request, res: Response) => {
  const destination = (req.query.destination as string)?.trim();
  if (!destination) {
    res.status(400).json({ error: "destination query parameter is required" });
    return;
  }

  const permits = await db
    .select()
    .from(permitTypesTable)
    .where(eq(permitTypesTable.destination, destination));

  res.json(permits.map((p) => ({
    id: p.id,
    destination: p.destination,
    permitName: p.permitName,
    description: p.description,
    priceNPR: p.priceNPR,
    priceUSD: p.priceUSD,
    issuingAuthority: p.issuingAuthority,
    documentUrl: p.documentUrl,
    validityDays: p.validityDays,
    required: p.required,
  })));
});

// ---------------------------------------------------------------------------
// POST /permits/admin — agency creates a permit type
// ---------------------------------------------------------------------------
router.post("/permits/admin", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user.id));
  if (user?.role !== "agency") { res.status(403).json({ error: "Only agencies can manage permits" }); return; }

  const { destination, permitName, description, priceNPR, priceUSD, issuingAuthority, documentUrl, validityDays, required } = req.body;
  if (!destination || !permitName || !priceNPR || !priceUSD || !issuingAuthority) {
    res.status(400).json({ error: "Missing required fields: destination, permitName, priceNPR, priceUSD, issuingAuthority" });
    return;
  }

  const [permit] = await db
    .insert(permitTypesTable)
    .values({
      destination,
      permitName,
      description: description ?? null,
      priceNPR: Number(priceNPR),
      priceUSD: Number(priceUSD),
      issuingAuthority,
      documentUrl: documentUrl ?? null,
      validityDays: validityDays ? Number(validityDays) : 30,
      required: required ?? true,
    })
    .returning();

  res.status(201).json(permit);
});

// ---------------------------------------------------------------------------
// GET /permits/my — logged-in trekker's purchased permits
// ---------------------------------------------------------------------------
router.get("/permits/my", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const permits = await db
    .select({
      id: userPermitsTable.id,
      permitTypeId: userPermitsTable.permitTypeId,
      bookingId: userPermitsTable.bookingId,
      status: userPermitsTable.status,
      paymentMethod: userPermitsTable.paymentMethod,
      transactionId: userPermitsTable.transactionId,
      paidAt: userPermitsTable.paidAt,
      permitNumber: userPermitsTable.permitNumber,
      permitFileUrl: userPermitsTable.permitFileUrl,
      createdAt: userPermitsTable.createdAt,
      // joined permit type fields
      permitName: permitTypesTable.permitName,
      destination: permitTypesTable.destination,
      priceNPR: permitTypesTable.priceNPR,
      priceUSD: permitTypesTable.priceUSD,
      issuingAuthority: permitTypesTable.issuingAuthority,
      documentUrl: permitTypesTable.documentUrl,
    })
    .from(userPermitsTable)
    .leftJoin(permitTypesTable, eq(userPermitsTable.permitTypeId, permitTypesTable.id))
    .where(eq(userPermitsTable.userId, req.user.id));

  res.json(permits.map((p) => ({
    ...p,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  })));
});

// ---------------------------------------------------------------------------
// POST /permits/pay/khalti — initiate Khalti payment
// ---------------------------------------------------------------------------
router.post("/permits/pay/khalti", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { permitTypeId, bookingId } = req.body;
  if (!permitTypeId) { res.status(400).json({ error: "permitTypeId is required" }); return; }

  const [permitType] = await db.select().from(permitTypesTable).where(eq(permitTypesTable.id, permitTypeId));
  if (!permitType) { res.status(404).json({ error: "Permit type not found" }); return; }

  const secretKey = process.env.KHALTI_SECRET_KEY;
  if (!secretKey) { res.status(503).json({ error: "Khalti not configured" }); return; }

  // Create user_permit record
  const [userPermit] = await db
    .insert(userPermitsTable)
    .values({ userId: req.user.id, permitTypeId, bookingId: bookingId ?? null, status: "pending_payment", paymentMethod: "khalti" })
    .returning();

  const origin = getAppOrigin();
  const payload = {
    return_url: `${origin}/api/permits/verify/khalti?userPermitId=${userPermit.id}`,
    website_url: origin,
    amount: permitType.priceNPR * 100, // Khalti uses paisa
    purchase_order_id: userPermit.id,
    purchase_order_name: permitType.permitName,
  };

  try {
    const khaltiRes = await fetch("https://a.khalti.com/api/v2/epayment/initiate/", {
      method: "POST",
      headers: { Authorization: `Key ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await khaltiRes.json() as { payment_url?: string; pidx?: string };
    if (!khaltiRes.ok || !data.payment_url) {
      logger.error({ data }, "Khalti initiation failed");
      res.status(502).json({ error: "Khalti payment initiation failed" });
      return;
    }
    await db.update(userPermitsTable).set({ transactionId: data.pidx ?? null }).where(eq(userPermitsTable.id, userPermit.id));
    res.json({ paymentUrl: data.payment_url, userPermitId: userPermit.id });
  } catch (err) {
    logger.error({ err }, "Khalti request error");
    res.status(502).json({ error: "Khalti service unavailable" });
  }
});

// ---------------------------------------------------------------------------
// POST /permits/pay/esewa — initiate eSewa payment
// ---------------------------------------------------------------------------
router.post("/permits/pay/esewa", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { permitTypeId, bookingId } = req.body;
  if (!permitTypeId) { res.status(400).json({ error: "permitTypeId is required" }); return; }

  const [permitType] = await db.select().from(permitTypesTable).where(eq(permitTypesTable.id, permitTypeId));
  if (!permitType) { res.status(404).json({ error: "Permit type not found" }); return; }

  const merchantCode = process.env.ESEWA_MERCHANT_CODE;
  const secretKey = process.env.ESEWA_SECRET_KEY;
  if (!merchantCode || !secretKey) { res.status(503).json({ error: "eSewa not configured" }); return; }

  const [userPermit] = await db
    .insert(userPermitsTable)
    .values({ userId: req.user.id, permitTypeId, bookingId: bookingId ?? null, status: "pending_payment", paymentMethod: "esewa" })
    .returning();

  const origin = getAppOrigin();
  const amount = permitType.priceNPR;
  const txnId = userPermit.id;

  // eSewa signed message: total_amount,transaction_uuid,product_code
  const message = `total_amount=${amount},transaction_uuid=${txnId},product_code=${merchantCode}`;
  const signature = crypto.createHmac("sha256", secretKey).update(message).digest("base64");

  const formData = {
    amount: String(amount),
    tax_amount: "0",
    total_amount: String(amount),
    transaction_uuid: txnId,
    product_code: merchantCode,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: `${origin}/api/permits/verify/esewa?userPermitId=${txnId}`,
    failure_url: `${origin}/permits/failed`,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature,
  };

  res.json({ formAction: "https://rc-epay.esewa.com.np/api/epay/main/v2/form", formData, userPermitId: userPermit.id });
});

// ---------------------------------------------------------------------------
// POST /permits/pay/stripe — create Stripe Checkout Session (USD)
// ---------------------------------------------------------------------------
router.post("/permits/pay/stripe", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { permitTypeId, bookingId } = req.body;
  if (!permitTypeId) { res.status(400).json({ error: "permitTypeId is required" }); return; }

  const [permitType] = await db.select().from(permitTypesTable).where(eq(permitTypesTable.id, permitTypeId));
  if (!permitType) { res.status(404).json({ error: "Permit type not found" }); return; }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) { res.status(503).json({ error: "Stripe not configured" }); return; }

  const [userPermit] = await db
    .insert(userPermitsTable)
    .values({ userId: req.user.id, permitTypeId, bookingId: bookingId ?? null, status: "pending_payment", paymentMethod: "stripe" })
    .returning();

  const origin = getAppOrigin();

  try {
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "mode": "payment",
        "success_url": `${origin}/api/permits/verify/stripe?session_id={CHECKOUT_SESSION_ID}&userPermitId=${userPermit.id}`,
        "cancel_url": `${origin}/permits/failed`,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": permitType.permitName,
        "line_items[0][price_data][unit_amount]": String(permitType.priceUSD * 100),
        "line_items[0][quantity]": "1",
      }),
    });
    const session = await stripeRes.json() as { url?: string; id?: string };
    if (!stripeRes.ok || !session.url) {
      logger.error({ session }, "Stripe session creation failed");
      res.status(502).json({ error: "Stripe session creation failed" });
      return;
    }
    await db.update(userPermitsTable).set({ transactionId: session.id ?? null }).where(eq(userPermitsTable.id, userPermit.id));
    res.json({ paymentUrl: session.url, userPermitId: userPermit.id });
  } catch (err) {
    logger.error({ err }, "Stripe request error");
    res.status(502).json({ error: "Stripe service unavailable" });
  }
});

// ---------------------------------------------------------------------------
// POST /permits/pay/offline — mark as offline pending
// ---------------------------------------------------------------------------
router.post("/permits/pay/offline", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { permitTypeId, bookingId } = req.body;
  if (!permitTypeId) { res.status(400).json({ error: "permitTypeId is required" }); return; }

  const [permitType] = await db.select().from(permitTypesTable).where(eq(permitTypesTable.id, permitTypeId));
  if (!permitType) { res.status(404).json({ error: "Permit type not found" }); return; }

  const [userPermit] = await db
    .insert(userPermitsTable)
    .values({ userId: req.user.id, permitTypeId, bookingId: bookingId ?? null, status: "offline_pending", paymentMethod: "offline" })
    .returning();

  res.status(201).json({
    id: userPermit.id,
    status: userPermit.status,
    message: "Permit reserved. Present payment receipt to your agency on trek day.",
  });
});

// ---------------------------------------------------------------------------
// Verification endpoints
// ---------------------------------------------------------------------------

// POST /permits/verify/khalti — Khalti redirect verification
router.post("/permits/verify/khalti", async (req: Request, res: Response) => {
  const { userPermitId } = req.query as { userPermitId?: string };
  const pidx = req.body.pidx || req.query.pidx;

  if (!userPermitId || !pidx) { res.status(400).json({ error: "Missing parameters" }); return; }

  const secretKey = process.env.KHALTI_SECRET_KEY;
  if (!secretKey) { res.status(503).json({ error: "Khalti not configured" }); return; }

  try {
    const lookupRes = await fetch("https://a.khalti.com/api/v2/epayment/lookup/", {
      method: "POST",
      headers: { Authorization: `Key ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pidx }),
    });
    const data = await lookupRes.json() as { status?: string };
    if (data.status === "Completed") {
      const permitNumber = `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      await db.update(userPermitsTable).set({
        status: "paid",
        transactionId: String(pidx),
        paidAt: new Date(),
        permitNumber,
      }).where(eq(userPermitsTable.id, userPermitId));
      res.redirect(`/permits/success?id=${userPermitId}`);
    } else {
      res.redirect(`/permits/failed`);
    }
  } catch {
    res.redirect(`/permits/failed`);
  }
});

// POST /permits/verify/esewa — eSewa redirect verification
router.post("/permits/verify/esewa", async (req: Request, res: Response) => {
  const userPermitId = (req.query.userPermitId || req.body.transaction_uuid) as string;
  const encodedData = req.body.data || req.query.data;

  if (!userPermitId) { res.status(400).json({ error: "Missing userPermitId" }); return; }

  // eSewa sends base64-encoded JSON with transaction details
  if (encodedData) {
    try {
      const decoded = JSON.parse(Buffer.from(encodedData as string, "base64").toString());
      if (decoded.status === "COMPLETE") {
        const permitNumber = `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        await db.update(userPermitsTable).set({
          status: "paid",
          transactionId: decoded.transaction_code ?? null,
          paidAt: new Date(),
          permitNumber,
        }).where(eq(userPermitsTable.id, userPermitId));
        res.redirect(`/permits/success?id=${userPermitId}`);
        return;
      }
    } catch {}
  }
  res.redirect(`/permits/failed`);
});

// GET /permits/verify/stripe — Stripe success redirect
router.get("/permits/verify/stripe", async (req: Request, res: Response) => {
  const { session_id, userPermitId } = req.query as { session_id?: string; userPermitId?: string };
  if (!session_id || !userPermitId) { res.redirect("/permits/failed"); return; }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) { res.redirect("/permits/failed"); return; }

  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const session = await stripeRes.json() as { payment_status?: string };
    if (session.payment_status === "paid") {
      const permitNumber = `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      await db.update(userPermitsTable).set({
        status: "paid",
        transactionId: session_id,
        paidAt: new Date(),
        permitNumber,
      }).where(eq(userPermitsTable.id, userPermitId));
      res.redirect(`/permits/success?id=${userPermitId}`);
    } else {
      res.redirect(`/permits/failed`);
    }
  } catch {
    res.redirect(`/permits/failed`);
  }
});

export default router;
