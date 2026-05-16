// @ts-nocheck
import nodemailer from "nodemailer";
import { logger } from "./logger.js";

function createTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const transporter = createTransporter();
  if (!transporter) {
    logger.info({ to: params.to, subject: params.subject }, "Email skipped — SMTP not configured");
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@trekora.app",
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
  logger.info({ to: params.to, subject: params.subject }, "Email sent");
}
