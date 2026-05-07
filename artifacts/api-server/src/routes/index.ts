import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import treksRouter from "./treks";
import joinRequestsRouter from "./joinRequests";
import customRequestsRouter from "./customRequests";
import bidsRouter from "./bids";
import bookingsRouter from "./bookings";
import dashboardRouter from "./dashboard";
import notificationsRouter from "./notifications";
import threadsRouter from "./threads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(treksRouter);
router.use(joinRequestsRouter);
router.use(customRequestsRouter);
router.use(bidsRouter);
router.use(bookingsRouter);
router.use(dashboardRouter);
router.use(notificationsRouter);
router.use(threadsRouter);

export default router;
