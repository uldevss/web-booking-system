import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Fast, optimistic route protection based on the session token (see the
// `authorized` callback in auth.config.ts). Pages and API routes still check
// permissions against the database.
const { auth } = NextAuth(authConfig);

export { auth as proxy };

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/provider/:path*",
    "/employee/:path*",
    "/admin/:path*",
    "/notifications",
    "/login",
    "/register",
  ],
};
