import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendEmail } from "./email";
import { logger } from "./logger";

export type NotificationType = "join_accepted" | "join_rejected" | "bid_received" | "bid_selected";

/**
 * Resolve the app's base URL from the BASE_PATH env var.
 * BASE_PATH may be a full origin (https://myapp.replit.app) or just a path
 * prefix (/). We normalise it to a full URL so email links are absolute.
 */
function resolveAppUrl(path: string): string {
  const base = (process.env.BASE_PATH ?? "").replace(/\/+$/, "");
  // If BASE_PATH already looks like an origin, use it directly.
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${base}${path}`;
  }
  // Fall back to a relative path — better than nothing when BASE_PATH is unset.
  return `${base}${path}`;
}

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  /** App-relative path for the CTA button in the email, e.g. "/dashboard" */
  actionUrl?: string;
}) {
  const [notification] = await db
    .insert(notificationsTable)
    .values({
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
    })
    .returning();

  const [user] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, params.userId));

  if (user?.email) {
    const actionUrl = params.actionUrl ? resolveAppUrl(params.actionUrl) : null;

    const ctaButton = actionUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
          <tr>
            <td style="border-radius:6px;background:#2563eb;">
              <a href="${actionUrl}"
                 style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;">
                View in Trekora →
              </a>
            </td>
          </tr>
        </table>`
      : "";

    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
        <h2 style="font-size:20px;margin-bottom:8px;">${params.title}</h2>
        <p style="font-size:15px;line-height:1.6;color:#374151;">${params.message}</p>
        ${ctaButton}
        <p style="margin-top:32px;font-size:12px;color:#9ca3af;">— The Trekora Team</p>
      </div>`;

    sendEmail({
      to: user.email,
      subject: `Trekora: ${params.title}`,
      text: actionUrl
        ? `${params.message}\n\nView in Trekora: ${actionUrl}`
        : params.message,
      html,
    }).catch((err: unknown) => {
      logger.warn({ err }, "Failed to send notification email");
    });
  }

  return notification;
}
