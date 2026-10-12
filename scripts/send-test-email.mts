// Sends a test notification email to check the email settings in .env.
//   npm run email:test -- you@gmail.com

import "dotenv/config";
// `server-only` is a no-op outside Next.js; tsx resolves it to the stub below.
import { emailTransport, notificationEmail, sendEmail } from "../lib/email";

const to = process.argv[2];
if (!to || !to.includes("@")) {
  console.error("Usage: npm run email:test -- you@example.com");
  process.exit(1);
}

const transport = emailTransport();
console.log(`Email transport: ${transport}${transport === "gmail" ? ` (${process.env.GMAIL_USER})` : ""}`);
if (transport === "console") {
  console.log("GMAIL_USER / GMAIL_APP_PASSWORD are not set in .env, so the email is only printed below.\n");
}

const ok = await sendEmail(
  notificationEmail(
    { name: "there", email: to },
    {
      title: "Test email from your booking system",
      message: "If you can read this, notification emails are working.",
      link: "/dashboard/notifications",
    },
  ),
);
console.log(ok ? `Sent to ${to}.` : "Sending failed; see the error above.");
process.exit(ok ? 0 : 1);
