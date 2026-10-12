import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI settings (migrate, generate, seed, studio). The app itself
// connects through the pg driver adapter in lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations should use a direct (non-pooled) connection when one is available.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
