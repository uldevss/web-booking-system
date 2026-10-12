import "server-only";
import nodemailer from "nodemailer";
import { siteConfig } from "./config";

// Delivers mail to each account's email address (Gmail or any other).
//   1. Gmail SMTP when GMAIL_USER + GMAIL_APP_PASSWORD are set (a Google
//      "app password", see README) — the platform's own Gmail sends the mail.
//   2. Otherwise Resend's HTTP API when RESEND_API_KEY is set.
//   3. Otherwise the mail is printed to the server console (development).
// Failures are logged, never thrown: a mail outage must not break a booking.

export type Email = { to: string; subject: string; text: string; html: string };

export type EmailTransport = "gmail" | "resend" | "console";

export function emailTransport(): EmailTransport {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  if (process.env.RESEND_API_KEY) return "resend";
  return "console";
}

function fromAddress() {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.GMAIL_USER) return `${siteConfig.name} <${process.env.GMAIL_USER}>`;
  return `${siteConfig.name} <onboarding@resend.dev>`;
}

let gmail: nodemailer.Transporter | undefined;

function gmailTransport() {
  gmail ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return gmail;
}

/** Sends one email; resolves to true when the transport accepted it. */
export async function sendEmail(email: Email): Promise<boolean> {
  const transport = emailTransport();
  try {
    if (transport === "gmail") {
      await gmailTransport().sendMail({
        from: fromAddress(),
        to: email.to,
        // Replies go to a real mailbox; spam filters distrust no-reply senders.
        replyTo: process.env.GMAIL_USER,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      return true;
    }
    if (transport === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromAddress(), to: email.to, subject: email.subject, text: email.text, html: email.html }),
      });
      if (!response.ok) {
        console.error(`[email] Resend rejected "${email.subject}": ${response.status} ${await response.text()}`);
        return false;
      }
      return true;
    }
    console.info(`[email:dev] To: ${email.to} | ${email.subject}\n${email.text}\n`);
    return true;
  } catch (error) {
    console.error(`[email] Could not send "${email.subject}" to ${email.to}`, error);
    return false;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function absoluteUrl(path: string) {
  const base = process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  return new URL(path, base).toString();
}

/** Email version of an in-app notification. */
export function notificationEmail(
  user: { name: string; email: string },
  note: { title: string; message: string; link?: string },
): Email {
  const url = note.link ? absoluteUrl(note.link) : null;
  const text = [
    `Hi ${user.name},`,
    "",
    note.message,
    ...(url ? ["", `Open: ${url}`] : []),
    "",
    `— ${siteConfig.name}`,
    "You can turn off email notifications in your profile settings.",
  ].join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#18181b;max-width:560px">
  <p style="margin:0 0 4px;font-size:13px;color:#71717a">${escapeHtml(siteConfig.name)}</p>
  <h1 style="margin:0 0 16px;font-size:20px">${escapeHtml(note.title)}</h1>
  <p>Hi ${escapeHtml(user.name)},</p>
  <p>${escapeHtml(note.message)}</p>
  ${url ? `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#18181b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">View details</a></p>` : ""}
  <p style="font-size:13px;color:#71717a">You can turn off email notifications in your profile settings.</p>
</div>`;

  return { to: user.email, subject: note.title, text, html };
}
