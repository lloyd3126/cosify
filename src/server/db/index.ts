import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dbFile = process.env.DATABASE_PATH || ".data/app.sqlite";

mkdirSync(dirname(dbFile), { recursive: true });
const sqlite = new Database(dbFile);

// Set some sane SQLite pragmas for web apps
try {
	sqlite.pragma("journal_mode = WAL");
	sqlite.pragma("synchronous = NORMAL");
} catch { }

// Create Better Auth required tables if they don't exist (idempotent)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	name TEXT,
	email TEXT NOT NULL UNIQUE,
	email_verified INTEGER NOT NULL DEFAULT 0,
	image TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
	id TEXT PRIMARY KEY,
	provider_id TEXT NOT NULL,
	account_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	access_token TEXT,
	refresh_token TEXT,
	id_token TEXT,
	access_token_expires_at INTEGER,
	scope TEXT,
	token_type TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	UNIQUE(provider_id, account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
	id TEXT,
	token TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	ip_address TEXT,
	user_agent TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
	id TEXT PRIMARY KEY,
	identifier TEXT NOT NULL UNIQUE,
	value TEXT NOT NULL,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flow_runs (
	run_id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	slug TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'active',
	error TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flow_run_steps (
	run_id TEXT NOT NULL,
	step_id TEXT NOT NULL,
	r2_key TEXT,
	duration_ms INTEGER,
	model TEXT,
	prompt TEXT,
	temperature INTEGER,
	error TEXT,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (run_id, step_id)
);
`);
// Backfill: add updated_at to verification if missing (older dev DBs)
try {
	const hasUpdatedAt = sqlite
		.prepare(
			"SELECT 1 FROM pragma_table_info('verification') WHERE name='updated_at'"
		)
		.get();
	if (!hasUpdatedAt) {
		sqlite.exec(
			"ALTER TABLE verification ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)"
		);
	}
} catch { }
// Backfill: add ip_address & user_agent to sessions if missing
try {
	const hasIp = sqlite
		.prepare(
			"SELECT 1 FROM pragma_table_info('sessions') WHERE name='ip_address'"
		)
		.get();
	if (!hasIp) {
		sqlite.exec("ALTER TABLE sessions ADD COLUMN ip_address TEXT");
	}
	const hasUa = sqlite
		.prepare(
			"SELECT 1 FROM pragma_table_info('sessions') WHERE name='user_agent'"
		)
		.get();
	if (!hasUa) {
		sqlite.exec("ALTER TABLE sessions ADD COLUMN user_agent TEXT");
	}
	const hasId = sqlite
		.prepare(
			"SELECT 1 FROM pragma_table_info('sessions') WHERE name='id'"
		)
		.get();
	if (!hasId) {
		sqlite.exec("ALTER TABLE sessions ADD COLUMN id TEXT");
	}
} catch { }
export const db = drizzle(sqlite, { schema });
export { schema };
