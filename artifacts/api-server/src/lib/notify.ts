import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendEmail } from "./email";
import { logger } from "./logger";

export type NotificationType = "join_accepted" | "join_rejected" | "bid_received" | "bid_selected";

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
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

  const [user] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, params.userId));
  if (user?.email) {
    sendEmail({
      to: user.email,
      subject: `Trekora: ${params.title}`,
      text: params.message,
      html: `<p>${params.message}</p><p style="margin-top:16px;color:#888;font-size:13px;">— The Trekora Team</p>`,
    }).catch((err: unknown) => {
      logger.warn({ err }, "Failed to send notification email");
    });
  }

  return notification;
}
