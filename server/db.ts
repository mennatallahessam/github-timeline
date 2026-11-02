import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { DatabaseSync as SqliteDatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { parseRepo, parseUser } from '../src/api/github';
import type { GitHubRepo, GitHubUser, TimelineData } from '../src/types/github';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: typeof SqliteDatabaseSync };

export const DEFAULT_DB_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface CachedTimelineRecord {
  username: string;
  data: TimelineData;
  fetchedAt: number;
  expiresAt: number;
  lookupCount: number;
}

export interface TimelineStore {
  readonly driver: 'sqlite' | 'postgres';
  init(): Promise<void>;
  get(username: string): Promise<CachedTimelineRecord | null>;
  save(
    username: string,
    data: TimelineData,
    now?: number,
    ttlMs?: number,
  ): Promise<CachedTimelineRecord>;
  touchLookup(username: string, now?: number): Promise<void>;
  getStats(): Promise<{ cachedProfiles: number; totalLookups: number }>;
  close(): Promise<void>;
}

function reviveTimelineData(userJson: string, reposJson: string): TimelineData | null {
  try {
    const rawUser: unknown = JSON.parse(userJson);
    const rawRepos: unknown = JSON.parse(reposJson);
    const user = parseUser(rawUser);
    if (!user || !Array.isArray(rawRepos)) return null;
    const repos: GitHubRepo[] = [];
    for (const item of rawRepos) {
      const parsed = parseRepo(item);
      if (!parsed) return null;
      repos.push(parsed);
    }
    return { user, repos };
  } catch {
    return null;
  }
}

/**
 * Embedded SQLite store powered by Node's built-in `node:sqlite`.
 * Used automatically in local development and tests when `DATABASE_URL` is not set.
 */
export class SqliteTimelineStore implements TimelineStore {
  readonly driver = 'sqlite' as const;
  private readonly db: SqliteDatabaseSync;

  constructor(filename = ':memory:') {
    if (filename !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    }
    this.db = new DatabaseSync(filename);
  }

  async init(): Promise<void> {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS timeline_cache (
        username TEXT PRIMARY KEY,
        login TEXT NOT NULL,
        user_json TEXT NOT NULL,
        repos_json TEXT NOT NULL,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        lookup_count INTEGER NOT NULL DEFAULT 1
      );
    `);
  }

  async get(username: string): Promise<CachedTimelineRecord | null> {
    const key = username.toLowerCase();
    const stmt = this.db.prepare(
      `SELECT username, user_json, repos_json, fetched_at, expires_at, lookup_count
       FROM timeline_cache WHERE username = ?`,
    );
    const row = stmt.get(key) as
      | {
          username: string;
          user_json: string;
          repos_json: string;
          fetched_at: number;
          expires_at: number;
          lookup_count: number;
        }
      | undefined;

    if (!row) return null;
    const data = reviveTimelineData(row.user_json, row.repos_json);
    if (!data) return null;

    return {
      username: row.username,
      data,
      fetchedAt: Number(row.fetched_at),
      expiresAt: Number(row.expires_at),
      lookupCount: Number(row.lookup_count),
    };
  }

  async save(
    username: string,
    data: TimelineData,
    now = Date.now(),
    ttlMs = DEFAULT_DB_CACHE_TTL_MS,
  ): Promise<CachedTimelineRecord> {
    const key = username.toLowerCase();
    const expiresAt = now + ttlMs;
    const stmt = this.db.prepare(`
      INSERT INTO timeline_cache (username, login, user_json, repos_json, fetched_at, expires_at, lookup_count)
      VALUES (?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(username) DO UPDATE SET
        login = excluded.login,
        user_json = excluded.user_json,
        repos_json = excluded.repos_json,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        lookup_count = timeline_cache.lookup_count + 1
      RETURNING lookup_count;
    `);
    const result = stmt.get(
      key,
      data.user.login,
      JSON.stringify(data.user satisfies GitHubUser),
      JSON.stringify(data.repos),
      now,
      expiresAt,
    ) as { lookup_count: number } | undefined;

    return {
      username: key,
      data,
      fetchedAt: now,
      expiresAt,
      lookupCount: Number(result?.lookup_count ?? 1),
    };
  }

  async touchLookup(username: string): Promise<void> {
    const key = username.toLowerCase();
    this.db
      .prepare(`UPDATE timeline_cache SET lookup_count = lookup_count + 1 WHERE username = ?`)
      .run(key);
  }

  async getStats(): Promise<{ cachedProfiles: number; totalLookups: number }> {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(lookup_count), 0) AS total FROM timeline_cache`,
      )
      .get() as { count: number; total: number };
    return {
      cachedProfiles: Number(row.count),
      totalLookups: Number(row.total),
    };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * PostgreSQL store used in production (e.g. Render PostgreSQL) when `DATABASE_URL` is configured.
 */
export class PostgresTimelineStore implements TimelineStore {
  readonly driver = 'postgres' as const;
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    const useSsl =
      !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
    this.pool = new pg.Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS timeline_cache (
        username TEXT PRIMARY KEY,
        login TEXT NOT NULL,
        user_json TEXT NOT NULL,
        repos_json TEXT NOT NULL,
        fetched_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        lookup_count INTEGER NOT NULL DEFAULT 1
      );
    `);
  }

  async get(username: string): Promise<CachedTimelineRecord | null> {
    const key = username.toLowerCase();
    const { rows } = await this.pool.query<{
      username: string;
      user_json: string;
      repos_json: string;
      fetched_at: string;
      expires_at: string;
      lookup_count: number;
    }>(
      `SELECT username, user_json, repos_json, fetched_at, expires_at, lookup_count
       FROM timeline_cache WHERE username = $1`,
      [key],
    );
    const row = rows[0];
    if (!row) return null;
    const data = reviveTimelineData(row.user_json, row.repos_json);
    if (!data) return null;

    return {
      username: row.username,
      data,
      fetchedAt: Number(row.fetched_at),
      expiresAt: Number(row.expires_at),
      lookupCount: Number(row.lookup_count),
    };
  }

  async save(
    username: string,
    data: TimelineData,
    now = Date.now(),
    ttlMs = DEFAULT_DB_CACHE_TTL_MS,
  ): Promise<CachedTimelineRecord> {
    const key = username.toLowerCase();
    const expiresAt = now + ttlMs;
    const { rows } = await this.pool.query<{ lookup_count: number }>(
      `INSERT INTO timeline_cache (username, login, user_json, repos_json, fetched_at, expires_at, lookup_count)
       VALUES ($1, $2, $3, $4, $5, $6, 1)
       ON CONFLICT(username) DO UPDATE SET
         login = EXCLUDED.login,
         user_json = EXCLUDED.user_json,
         repos_json = EXCLUDED.repos_json,
         fetched_at = EXCLUDED.fetched_at,
         expires_at = EXCLUDED.expires_at,
         lookup_count = timeline_cache.lookup_count + 1
       RETURNING lookup_count`,
      [key, data.user.login, JSON.stringify(data.user), JSON.stringify(data.repos), now, expiresAt],
    );
    return {
      username: key,
      data,
      fetchedAt: now,
      expiresAt,
      lookupCount: Number(rows[0]?.lookup_count ?? 1),
    };
  }

  async touchLookup(username: string): Promise<void> {
    await this.pool.query(
      `UPDATE timeline_cache SET lookup_count = lookup_count + 1 WHERE username = $1`,
      [username.toLowerCase()],
    );
  }

  async getStats(): Promise<{ cachedProfiles: number; totalLookups: number }> {
    const { rows } = await this.pool.query<{ count: string; total: string }>(
      `SELECT COUNT(*)::text AS count, COALESCE(SUM(lookup_count), 0)::text AS total FROM timeline_cache`,
    );
    return {
      cachedProfiles: Number(rows[0]?.count ?? 0),
      totalLookups: Number(rows[0]?.total ?? 0),
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export interface CreateStoreOptions {
  databaseUrl?: string;
  sqlitePath?: string;
}

/**
 * Factory that creates a PostgreSQL store when `DATABASE_URL` is present,
 * or falls back to a local SQLite database file (`./data/timeline.sqlite`).
 */
export async function createTimelineStore(
  options: CreateStoreOptions = {},
): Promise<TimelineStore> {
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  const store: TimelineStore = databaseUrl
    ? new PostgresTimelineStore(databaseUrl)
    : new SqliteTimelineStore(
        options.sqlitePath ?? process.env.SQLITE_PATH ?? path.resolve('data/timeline.sqlite'),
      );
  await store.init();
  return store;
}
