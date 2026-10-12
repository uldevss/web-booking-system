import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { siteConfig } from "./config";
import { emailTransport, sendEmail } from "./email";
import { AppError } from "./errors";
import { prisma } from "./prisma";
import { rateLimit, retryMessage } from "./rate-limit";

// Email ownership check at sign-up: a 6-digit code is emailed to the address
// and must be entered before the account can be used. Only a hash of the code
// is stored; codes expire after CODE_TTL_MINUTES.

export const CODE_TTL_MINUTES = 15;
const CODE_LENGTH = 6;

const hash = (code: string) => createHash("sha256").update(code).digest("hex");

export function isVerified(user: { emailVerifiedAt: Date | null }) {
  return user.emailVerifiedAt !== null;
}

/**
 * Creates a fresh code for the user and emails it. Limited to a few sends per
 * user per 10 minutes so the mailbox can't be flooded.
 */
export async function sendVerificationCode(user: { id: string; name: string; email: string }) {
  const limit = await rateLimit(`verify-send:${user.id}`, 4, 10 * 60);
  if (!limit.ok) throw new AppError("RATE_LIMITED", retryMessage(limit.retryAfterSeconds));

  const code = randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");
  await prisma.user.update({
    where: { id: user.id },
    data: { emailCodeHash: hash(code), emailCodeExpiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000) },
  });

  // A natural sentence with the app name and the person's first name reads as a
  // normal message to spam filters; a bare number as the subject does not.
  const firstName = user.name.split(" ")[0];
  const subject = `${firstName}, confirm your ${siteConfig.name} account`;
  const text = [
    `Hi ${user.name},`,
    "",
    `Thanks for signing up to ${siteConfig.name}. To confirm this is your email address, enter this code on the verification page:`,
    "",
    `    ${code}`,
    "",
    `The code works for ${CODE_TTL_MINUTES} minutes. If this email ended up in your spam folder, please mark it as \"Not spam\" so booking updates reach your inbox.`,
    "If you didn't sign up, you can ignore this email or reply to let us know.",
    "",
    `— ${siteConfig.name}`,
  ].join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#18181b;max-width:560px">
  <p style="margin:0 0 4px;font-size:13px;color:#71717a">${siteConfig.name}</p>
  <h1 style="margin:0 0 16px;font-size:20px">Verify your email</h1>
  <p>Hi ${user.name.replaceAll("<", "&lt;")},</p>
  <p>Thanks for signing up to ${siteConfig.name}. To confirm this is your email address, enter this code on the verification page:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:0.3em;margin:8px 0 16px">${code}</p>
  <p>The code works for ${CODE_TTL_MINUTES} minutes. If this email ended up in your spam folder, please mark it as &quot;Not spam&quot; so booking updates reach your inbox.</p>
  <p style="font-size:13px;color:#71717a">If you didn't sign up, you can ignore this email or reply to let us know.</p>
</div>`;
  await sendEmail({ to: user.email, subject, text, html });
}

/** Checks a submitted code; marks the email verified when it matches. */
export async function confirmVerificationCode(userId: string, code: string) {
  const limit = await rateLimit(`verify-check:${userId}`, 10, 15 * 60);
  if (!limit.ok) throw new AppError("RATE_LIMITED", retryMessage(limit.retryAfterSeconds));

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true, emailCodeHash: true, emailCodeExpiresAt: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "Account not found.");
  if (user.emailVerifiedAt) return;
  if (!user.emailCodeHash || !user.emailCodeExpiresAt || user.emailCodeExpiresAt < new Date()) {
    throw new AppError("INVALID_STATE", "That code has expired. Request a new one.");
  }
  const expected = Buffer.from(user.emailCodeHash, "hex");
  const given = Buffer.from(hash(code.trim()), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new AppError("INVALID_STATE", "That code isn't right. Check the email and try again.");
  }
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date(), emailCodeHash: null, emailCodeExpiresAt: null },
  });
}

/** True when codes are only printed to the dev console, so the page can say so. */
export function codesGoToConsole() {
  return emailTransport() === "console";
}
