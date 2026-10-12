import type { NextAuthConfig } from "next-auth";
import { homePathFor, rolesForPath } from "@/lib/roles";

// Settings shared by the proxy and the full Auth.js setup in auth.ts. Kept
// free of database code so the proxy stays light; the provider that checks
// passwords is added in auth.ts.

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
    // Optimistic route protection in the proxy, based on the session token.
    // Pages and API routes check again against the database.
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user;
      const { pathname } = nextUrl;

      // Signed-in users are sent away from /login and /register by those pages,
      // after checking the database, so a stale token (e.g. a user that no
      // longer exists) can't bounce between the login page and a dashboard.
      const allowed = rolesForPath(pathname);
      if (!allowed) return true;
      if (!user) return false; // Auth.js redirects to /login?callbackUrl=...
      if (!allowed.includes(user.role)) {
        return Response.redirect(new URL(homePathFor(user.role), nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
