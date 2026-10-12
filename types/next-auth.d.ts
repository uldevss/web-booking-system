import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/generated/prisma/enums";

// Adds the user's id and role to Auth.js types.

declare module "next-auth" {
  interface User {
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

// next-auth/jwt re-exports this interface from @auth/core, so augment it there.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
  }
}
