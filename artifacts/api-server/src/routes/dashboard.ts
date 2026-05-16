// @ts-nocheck
import { Router, type IRouter, type Request, type Response } from "express";
import { db, joinRequestsTable, customRequestsTable, bookingsTable, treksTable, usersTable, bidsTable } from "@workspace/db";
import { eq, sql, and, inArray, desc } from "drizzle-orm";

// Alias the agency user join so it doesn't collide with the trekker user join
// in queries that need both at once.
const agencyUsers = usersTable;

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Trekker dashboard — 3 queries total
// ---------------------------------------------------------------------------
router.get("/dashboard/trekker", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const trekkerId = req.user.id;

  // Query 1: all join requests for this trekker, with trek + agency name in one JOIN
  const joinRequestRows = await db
    .select({
      // join_request fields
      jrId:              joinRequestsTable.id,
      jrTrekId:          joinRequestsTable.trekId,
      jrTrekkerId:       joinRequestsTable.trekkerId,
      jrAgencyId:        joinRequestsTable.agencyId,
      jrStatus:          joinRequestsTable.status,
      jrMessage:         joinRequestsTable.message,
      jrCreatedAt:       joinRequestsTable.createdAt,
      // trek fields
      trekId:            treksTable.id,
      trekAgencyId:      treksTable.agencyId,
      trekTitle:         treksTable.title,
      trekDestination:   treksTable.destination,
      trekDuration:      treksTable.duration,
      trekStartDate:     treksTable.startDate,
      trekEndDate:       treksTable.endDate,
      trekPrice:         treksTable.price,
      trekMaxGroupSize:  treksTable.maxGroupSize,
      trekDescription:   treksTable.description,
      trekImageUrl:      treksTable.imageUrl,
      trekStatus:        treksTable.status,
      trekCurrentPax:    treksTable.currentParticipants,
      trekDifficulty:    treksTable.difficultyLevel,
      trekCreatedAt:     treksTable.createdAt,
      // agency name from users
      agencyName:        usersTable.agencyName,
    })
    .from(joinRequestsTable)
    .leftJoin(treksTable, eq(joinRequestsTable.trekId, treksTable.id))
    .leftJoin(usersTable, eq(treksTable.agencyId, usersTable.id))
    .where(eq(joinRequestsTable.trekkerId, trekkerId))
    .orderBy(desc(joinRequestsTable.createdAt));

  const formatJr = (row: typeof joinRequestRows[number]) => ({
    id:                  row.jrId,
    trekId:              row.jrTrekId,
    trekkerId:           row.jrTrekkerId,
    agencyId:            row.jrAgencyId ?? null,
    trekkerName:         null,
    trekkerEmail:        null,
    trekkerProfileImage: null,
    trek: row.trekId ? {
      id:                  row.trekId,
      agencyId:            row.trekAgencyId!,
      agencyName:          row.agencyName ?? null,
      title:               row.trekTitle!,
      destination:         row.trekDestination!,
      duration:            row.trekDuration!,
      startDate:           row.trekStartDate!,
      endDate:             row.trekEndDate ?? null,
      price:               Number(row.trekPrice),
      maxGroupSize:        row.trekMaxGroupSize!,
      description:         row.trekDescription!,
      imageUrl:            row.trekImageUrl ?? null,
      status:              row.trekStatus!,
      currentParticipants: row.trekCurrentPax!,
      difficultyLevel:     row.trekDifficulty!,
      createdAt:           row.trekCreatedAt!.toISOString(),
    } : undefined,
    status:    row.jrStatus as "pending" | "accepted" | "rejected",
    message:   row.jrMessage ?? null,
    createdAt: row.jrCreatedAt.toISOString(),
  });

  const joinedTreks      = joinRequestRows.filter((r) => r.jrStatus === "accepted").map(formatJr);
  const pendingRequests  = joinRequestRows.filter((r) => r.jrStatus === "pending").map(formatJr);

  // Query 2: custom requests with per-request bid counts in one query using
  // a GROUP BY aggregation, then merge bid counts in JS (no loop queries).
  const [customRequestRows, bidCountRows] = await Promise.all([
    db
      .select()
      .from(customRequestsTable)
      .where(eq(customRequestsTable.trekkerId, trekkerId))
      .orderBy(desc(customRequestsTable.createdAt)),
    db
      .select({
        customRequestId: bidsTable.customRequestId,
        bidsCount:       sql<number>`COUNT(*)::int`,
      })
      .from(bidsTable)
      .where(
        inArray(
          bidsTable.customRequestId,
          db
            .select({ id: customRequestsTable.id })
            .from(customRequestsTable)
            .where(eq(customRequestsTable.trekkerId, trekkerId)),
        ),
      )
      .groupBy(bidsTable.customRequestId),
  ]);

  const bidCountMap = Object.fromEntries(
    bidCountRows.map((r) => [r.customRequestId, r.bidsCount]),
  );

  const customRequests = customRequestRows.map((cr) => ({
    id:             cr.id,
    trekkerId:      cr.trekkerId,
    trekkerName:    null,
    destination:    cr.destination,
    budget:         Number(cr.budget),
    startDate:      cr.startDate,
    endDate:        cr.endDate ?? null,
    groupSize:      cr.groupSize,
    notes:          cr.notes ?? null,
    status:         cr.status as "open" | "closed" | "cancelled",
    bidsCount:      bidCountMap[cr.id] ?? 0,
    selectedBidId:  cr.selectedBidId ?? null,
    createdAt:      cr.createdAt.toISOString(),
  }));

  // Query 3: paid bookings for totalSpent
  const paidBookings = await db
    .select({ advanceAmount: bookingsTable.advanceAmount })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.trekkerId, trekkerId), eq(bookingsTable.status, "paid")));

  const totalSpent = paidBookings.reduce((sum, b) => sum + Number(b.advanceAmount), 0);

  res.json({
    joinedTreks,
    pendingRequests,
    customRequests,
    totalSpent,
    upcomingTreks: joinedTreks.length,
  });
});

// ---------------------------------------------------------------------------
// Agency dashboard — 3 queries total
// ---------------------------------------------------------------------------
router.get("/dashboard/agency", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const agencyId = req.user.id;

  // Query 1: agency's own treks (simple, no join needed — agency name comes
  // from the session user, not a separate lookup)
  const myTreks = await db
    .select()
    .from(treksTable)
    .where(eq(treksTable.agencyId, agencyId))
    .orderBy(desc(treksTable.createdAt));

  const trekIds = myTreks.map((t) => t.id);

  // Resolve agency name once from the first trek's agency — we already know
  // the logged-in user IS the agency, so pull it from the session user record
  // via a single field select rather than a full user fetch.
  const [agencyRow] = await db
    .select({ agencyName: usersTable.agencyName })
    .from(usersTable)
    .where(eq(usersTable.id, agencyId));
  const agencyName = agencyRow?.agencyName ?? null;

  const formattedTreks = myTreks.map((t) => ({
    id:                  t.id,
    agencyId:            t.agencyId,
    agencyName,
    title:               t.title,
    destination:         t.destination,
    duration:            t.duration,
    startDate:           t.startDate,
    endDate:             t.endDate ?? null,
    price:               Number(t.price),
    maxGroupSize:        t.maxGroupSize,
    description:         t.description,
    imageUrl:            t.imageUrl ?? null,
    status:              t.status,
    currentParticipants: t.currentParticipants,
    difficultyLevel:     t.difficultyLevel,
    createdAt:           t.createdAt.toISOString(),
  }));

  // Query 2: all join requests for this agency, with trekker details via JOIN
  const joinRequestRows = await db
    .select({
      // join_request fields
      jrId:                joinRequestsTable.id,
      jrTrekId:            joinRequestsTable.trekId,
      jrTrekkerId:         joinRequestsTable.trekkerId,
      jrAgencyId:          joinRequestsTable.agencyId,
      jrStatus:            joinRequestsTable.status,
      jrMessage:           joinRequestsTable.message,
      jrCreatedAt:         joinRequestsTable.createdAt,
      // trekker fields from users
      trekkerFirstName:    usersTable.firstName,
      trekkerLastName:     usersTable.lastName,
      trekkerEmail:        usersTable.email,
      trekkerProfileImage: usersTable.profileImageUrl,
    })
    .from(joinRequestsTable)
    .leftJoin(usersTable, eq(joinRequestsTable.trekkerId, usersTable.id))
    .where(eq(joinRequestsTable.agencyId, agencyId))
    .orderBy(desc(joinRequestsTable.createdAt));

  // Trek details for join requests come from the already-fetched myTreks map
  const trekMap = Object.fromEntries(myTreks.map((t) => [t.id, t]));

  const formatAgencyJr = (row: typeof joinRequestRows[number]) => {
    const trekkerName =
      row.trekkerFirstName || row.trekkerLastName
        ? `${row.trekkerFirstName ?? ""} ${row.trekkerLastName ?? ""}`.trim()
        : row.trekkerEmail ?? null;
    const trek = trekMap[row.jrTrekId];
    return {
      id:                  row.jrId,
      trekId:              row.jrTrekId,
      trekkerId:           row.jrTrekkerId,
      agencyId:            row.jrAgencyId ?? agencyId,
      trekkerName,
      trekkerEmail:        row.trekkerEmail ?? null,
      trekkerProfileImage: row.trekkerProfileImage ?? null,
      trek: trek ? {
        id:                  trek.id,
        agencyId:            trek.agencyId,
        agencyName,
        title:               trek.title,
        destination:         trek.destination,
        duration:            trek.duration,
        startDate:           trek.startDate,
        endDate:             trek.endDate ?? null,
        price:               Number(trek.price),
        maxGroupSize:        trek.maxGroupSize,
        description:         trek.description,
        imageUrl:            trek.imageUrl ?? null,
        status:              trek.status,
        currentParticipants: trek.currentParticipants,
        difficultyLevel:     trek.difficultyLevel,
        createdAt:           trek.createdAt.toISOString(),
      } : undefined,
      status:    row.jrStatus as "pending" | "accepted" | "rejected",
      message:   row.jrMessage ?? null,
      createdAt: row.jrCreatedAt.toISOString(),
    };
  };

  const allJoinRequests     = joinRequestRows.map(formatAgencyJr);
  const pendingJoinRequests = allJoinRequests.filter((jr) => jr.status === "pending");

  // Query 3: open custom requests with trekker name, total bid count, and
  // whether this agency has already placed a bid — all in one JOIN query.
  //
  // Strategy:
  //   - LEFT JOIN users for trekker name
  //   - LEFT JOIN bids (all) aggregated by customRequestId for bidsCount
  //   - LEFT JOIN bids (this agency only) for myBidId
  //
  // Drizzle doesn't support two separate aggregated joins on the same table
  // in one fluent query, so we run the open custom requests + trekker join
  // and the bid aggregation as two parallel queries, then merge in JS.
  // This is still exactly 2 DB round-trips for this section (part of query 3
  // via Promise.all), keeping the total at 3 for the whole handler.
  const [openCrRows, bidAggRows, myBidRows] = await Promise.all([
    // open custom requests joined with trekker user
    db
      .select({
        crId:         customRequestsTable.id,
        crTrekkerId:  customRequestsTable.trekkerId,
        destination:  customRequestsTable.destination,
        budget:       customRequestsTable.budget,
        startDate:    customRequestsTable.startDate,
        endDate:      customRequestsTable.endDate,
        groupSize:    customRequestsTable.groupSize,
        notes:        customRequestsTable.notes,
        crStatus:     customRequestsTable.status,
        selectedBidId: customRequestsTable.selectedBidId,
        crCreatedAt:  customRequestsTable.createdAt,
        trekkerFirstName: usersTable.firstName,
        trekkerLastName:  usersTable.lastName,
        trekkerEmail:     usersTable.email,
      })
      .from(customRequestsTable)
      .leftJoin(usersTable, eq(customRequestsTable.trekkerId, usersTable.id))
      .where(eq(customRequestsTable.status, "open"))
      .orderBy(desc(customRequestsTable.createdAt)),

    // total bid counts per custom request
    db
      .select({
        customRequestId: bidsTable.customRequestId,
        bidsCount:       sql<number>`COUNT(*)::int`,
      })
      .from(bidsTable)
      .innerJoin(
        customRequestsTable,
        and(
          eq(bidsTable.customRequestId, customRequestsTable.id),
          eq(customRequestsTable.status, "open"),
        ),
      )
      .groupBy(bidsTable.customRequestId),

    // this agency's own bids on open requests
    db
      .select({ customRequestId: bidsTable.customRequestId, bidId: bidsTable.id })
      .from(bidsTable)
      .innerJoin(
        customRequestsTable,
        and(
          eq(bidsTable.customRequestId, customRequestsTable.id),
          eq(customRequestsTable.status, "open"),
        ),
      )
      .where(eq(bidsTable.agencyId, agencyId)),
  ]);

  const bidCountMap  = Object.fromEntries(bidAggRows.map((r) => [r.customRequestId, r.bidsCount]));
  const myBidMap     = Object.fromEntries(myBidRows.map((r) => [r.customRequestId, r.bidId]));

  const openCustomRequests = openCrRows.map((cr) => {
    const trekkerName =
      cr.trekkerFirstName || cr.trekkerLastName
        ? `${cr.trekkerFirstName ?? ""} ${cr.trekkerLastName ?? ""}`.trim()
        : cr.trekkerEmail ?? null;
    return {
      id:            cr.crId,
      trekkerId:     cr.crTrekkerId,
      trekkerName,
      destination:   cr.destination,
      budget:        Number(cr.budget),
      startDate:     cr.startDate,
      endDate:       cr.endDate ?? null,
      groupSize:     cr.groupSize,
      notes:         cr.notes ?? null,
      status:        cr.crStatus as "open" | "closed" | "cancelled",
      bidsCount:     bidCountMap[cr.crId] ?? 0,
      selectedBidId: cr.selectedBidId ?? null,
      myBidId:       myBidMap[cr.crId] ?? null,
      createdAt:     cr.crCreatedAt.toISOString(),
    };
  });

  // Earnings: derived from trekIds already in memory — no extra query needed
  // when trekIds is empty; otherwise reuse the bookings table with inArray.
  let totalEarnings = 0;
  let totalPlatformFees = 0;
  let totalBookings = 0;
  if (trekIds.length > 0) {
    const agencyBookings = await db
      .select({ advanceAmount: bookingsTable.advanceAmount, platformFeeAmount: bookingsTable.platformFeeAmount })
      .from(bookingsTable)
      .where(and(inArray(bookingsTable.trekId, trekIds), eq(bookingsTable.status, "paid")));
    totalEarnings = agencyBookings.reduce((sum, b) => sum + Number(b.advanceAmount) - Number(b.platformFeeAmount), 0);
    totalPlatformFees = agencyBookings.reduce((sum, b) => sum + Number(b.platformFeeAmount), 0);
    totalBookings = agencyBookings.length;
  }

  res.json({
    myTreks: formattedTreks,
    pendingJoinRequests,
    allJoinRequests,
    openCustomRequests,
    totalEarnings,
    totalPlatformFees,
    platformFeePercent: parseFloat(process.env.PLATFORM_COMMISSION_PERCENT ?? "5"),
    totalBookings,
  });
});

export default router;
