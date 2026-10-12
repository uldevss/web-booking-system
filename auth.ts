import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { allowedEmailDomains, loginSchema } from "@/lib/validators";

class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

class AccountSuspended extends CredentialsSignin {
  code = "suspended";
}

// Compared against when the email is unknown, so a failed login takes about
// as long whether or not the account exists.
let dummyHash: string | undefined;

/** "Continue with Google" is offered when the OAuth client is configured. */
export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

function domainAllowed(email: string) {
  const domains = allowedEmailDomains();
  return domains.length === 0 || domains.includes(email.slice(email.lastIndexOf("@") + 1));
}

/**
 * Finds the account for a Google sign-in, creating a guest account on first
 * use. Google has already verified the address, so no code is needed.
 * Returns null when the account may not sign in.
 */
async function userForGoogle(profile: { email?: string | null; name?: string | null; email_verified?: boolean | null }) {
  const email = profile.email?.trim().toLowerCase();
  if (!email || profile.email_verified === false) return null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.isActive) return null;
    if (!existing.emailVerifiedAt) {
      await prisma.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date(), emailCodeHash: null, emailCodeExpiresAt: null } });
    }
    return existing;
  }

  if (!domainAllowed(email)) return null;
  // No password was chosen; a random one keeps the column valid. They can set
  // one later from their profile only by knowing it, so Google stays the way in.
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  return prisma.user.create({
    data: { name: profile.name?.trim() || email.split("@")[0], email, passwordHash, emailVerifiedAt: new Date() },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // 10 attempts per 15 minutes per email+IP, 50 per IP.
        const ip = clientIp(request.headers);
        const [perAccount, perIp] = await Promise.all([
          rateLimit(`login:${email}:${ip}`, 10, 15 * 60),
          rateLimit(`login-ip:${ip}`, 50, 15 * 60),
        ]);
        if (!perAccount.ok || !perIp.ok) throw new TooManyAttempts();

        const user = await prisma.user.findUnique({ where: { email } });
        dummyHash ??= await bcrypt.hash("not-a-real-password", 10);
        const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
        if (!user || !valid) return null;
        if (!user.isActive) throw new AccountSuspended();

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            // Always let the person pick which Google account to use.
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      return (await userForGoogle(profile ?? {})) !== null;
    },
    async jwt(params) {
      const { token, account, profile } = params;
      if (account?.provider === "google") {
        // `params.user` here is Google's profile, not our record: look ours up by email.
        const record = await userForGoogle(profile ?? {});
        if (record) {
          token.id = record.id;
          token.role = record.role;
          token.name = record.name;
        }
        return token;
      }
      return authConfig.callbacks.jwt(params);
    },
  },
});
