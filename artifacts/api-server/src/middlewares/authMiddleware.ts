// @ts-nocheck
import * as oidc from "openid-client";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  updateSession,
  type SessionData,
} from "../lib/auth.js";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || now <= session.expires_at) return session;

  if (!session.refresh_token) return null;

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(
      config,
      session.refresh_token,
    );
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    session.expires_at = tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : session.expires_at;
    await updateSession(sid, session);
    return session;
  } catch {
    return null;
  }
}

/**
 * Global authentication middleware.
 *
 * Runs on every request (registered in app.ts before routes). It:
 * 1. Extracts the session ID from either the `Authorization: Bearer <sid>`
 *    header or the `sid` httpOnly cookie (via `getSessionId`).
 * 2. Loads the session from the database.
 * 3. If the access token is expired and a refresh token exists, silently
 *    refreshes it via the OIDC provider and updates the stored session.
 * 4. Sets `req.user` with the authenticated user's profile data.
 *
 * If no valid session is found, the request proceeds unauthenticated —
 * individual route handlers check `req.isAuthenticated()` and return 401
 * as needed.
 *
 * Both cookie-based (web) and Bearer-token-based (mobile/API) clients
 * are handled identically through this single middleware.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  const refreshed = await refreshIfExpired(sid, session);
  if (!refreshed) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = refreshed.user;

  // Check if user is banned — reject with 403 if so
  const [dbUser] = await db
    .select({ isBanned: usersTable.isBanned })
    .from(usersTable)
    .where(eq(usersTable.id, refreshed.user.id));
  if (dbUser?.isBanned) {
    res.status(403).json({ error: "Your account has been suspended" });
    return;
  }

  next();
}
