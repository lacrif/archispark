import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "path";
import { fileURLToPath } from "url";
import { db } from "./connection.js";

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL("../drizzle", import.meta.url)));

export function runMigrations(): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
