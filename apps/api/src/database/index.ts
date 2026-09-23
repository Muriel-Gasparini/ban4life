import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

export function createDatabaseClient(databaseUrl: string): { db: DrizzleDB; sqlite: Database.Database } {
  // Strip 'file:' prefix if present
  let dbPath = databaseUrl.replace(/^file:/, '');
  
  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');

  // Auto-init tables if not exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_protected INTEGER NOT NULL DEFAULT 0,
      participant_count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spam_logs (
      id TEXT PRIMARY KEY,
      group_jid TEXT NOT NULL,
      group_name TEXT NOT NULL,
      sender_jid TEXT NOT NULL,
      message_text TEXT NOT NULL,
      jev_score REAL NOT NULL,
      jev_category TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
