// Local PostgreSQL for development, no Docker or installer needed.
// Runs a real Postgres server from the `embedded-postgres` package.
//
//   npm run db:start      (leave it running in its own terminal)
//
// Data is kept outside the project folder (OneDrive sync and database files
// don't mix) in ~/.booking-system/pgdata unless PG_DATA_DIR is set.
// For production use a hosted database (Neon, Supabase) via DATABASE_URL.

import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const dataDir = process.env.PG_DATA_DIR || join(homedir(), ".booking-system", "pgdata");
const port = Number(process.env.PG_PORT || 5433);
const databases = ["hospitality", "hospitality_test"];

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  onLog: () => {},
  onError: (message) => console.error(String(message).trim()),
});

const firstRun = !existsSync(join(dataDir, "PG_VERSION"));
if (firstRun) {
  mkdirSync(dirname(dataDir), { recursive: true });
  console.log(`Initialising a new database cluster in ${dataDir} ...`);
  await pg.initialise();
}

await pg.start();

// Create the databases as UTF-8. On Windows the cluster default is the
// system code page (WIN1252), which can't store "₱", emoji or most non-Latin
// text and makes inserts fail with "has no equivalent in encoding".
const { Client } = await import("pg");
const admin = new Client({ host: "localhost", port, user: "postgres", password: "postgres", database: "postgres" });
await admin.connect();
for (const name of databases) {
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (exists.rowCount) continue;
  await admin.query(`CREATE DATABASE "${name}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
  console.log(`Created database "${name}" (UTF-8).`);
}
await admin.end();

console.log(`\nPostgres is running on port ${port}.`);
console.log(`  DATABASE_URL="postgresql://postgres:postgres@localhost:${port}/hospitality"`);
console.log("Press Ctrl+C to stop.\n");

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\nStopping Postgres ...");
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep the process alive until it is interrupted.
setInterval(() => {}, 1 << 30);
