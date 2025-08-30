import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dbFile = process.env.DATABASE_PATH || ".data/app.sqlite";

mkdirSync(dirname(dbFile), { recursive: true });
const sqlite = new Database(dbFile);
export const db = drizzle(sqlite, { schema });
export { schema };
