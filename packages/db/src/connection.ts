import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import * as schema from "./schema.js";

const DEFAULT_DB_PATH = join(fileURLToPath(new URL("../../../data/archispark.db", import.meta.url)));
// v8 ignore next
const DB_PATH = process.env["DB_PATH"] ?? DEFAULT_DB_PATH;

mkdirSync(dirname(DB_PATH), { recursive: true });
const sqlite: InstanceType<typeof Database> = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
