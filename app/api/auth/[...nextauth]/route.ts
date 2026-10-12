import { handlers } from "@/auth";

// Auth.js endpoints: the Google OAuth redirect and callback live here
// (/api/auth/signin/google, /api/auth/callback/google, ...).
export const { GET, POST } = handlers;
