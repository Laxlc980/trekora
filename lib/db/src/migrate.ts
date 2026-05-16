// @ts-nocheck
/**
 * Standalone migration runner.
 *
 * Usage:
 *   pnpm --filter @workspace/db db:migrate
 *
 * Also imported and called by the api-server at startup (see artifacts/api-server/src/index.ts).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Resolve to lib/db/migrations regardless of where this file is called from.
const migrationsFolder = path.resolve(__dirname, "../../migrations");

export async function runMigrations(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Running database migrations…");
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");

  await pool.end();
}

// Allow running directly: `node migrate.js` or via the package script.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runMigrations().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
