import type { TimelineData } from '../types/github';
import { parseRepo, parseUser } from './github';

export const CACHE_TTL_MS = 10 * 60 * 1000;
const STORAGE_PREFIX = 'gh-timeline:v1:';

interface CacheEntry {
  data: TimelineData;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

const keyFor = (username: string): string => username.toLowerCase();

function getSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Accessing sessionStorage throws when storage is disabled (e.g. strict privacy modes).
    return null;
  }
}

/** Re-validates persisted data, since sessionStorage contents can be stale or tampered with. */
function reviveEntry(raw: string): CacheEntry | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { data, expiresAt } = parsed as { data?: unknown; expiresAt?: unknown };
    if (typeof expiresAt !== 'number' || typeof data !== 'object' || data === null) return null;

    const { user, repos } = data as { user?: unknown; repos?: unknown };
    const parsedUser = parseUser(user);
    if (!parsedUser || !Array.isArray(repos)) return null;

    const items: unknown[] = repos;
    const parsedRepos = items.map(parseRepo);
    if (parsedRepos.some((repo) => repo === null)) return null;

    return {
      data: { user: parsedUser, repos: parsedRepos.filter((repo) => repo !== null) },
      expiresAt,
    };
  } catch {
    return null;
  }
}

export function getCachedTimeline(username: string, now = Date.now()): TimelineData | null {
  const key = keyFor(username);

  const inMemory = memoryCache.get(key);
  if (inMemory) {
    if (inMemory.expiresAt > now) return inMemory.data;
    memoryCache.delete(key);
  }

  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return null;
    const entry = reviveEntry(raw);
    if (!entry || entry.expiresAt <= now) {
      storage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    memoryCache.set(key, entry);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedTimeline(username: string, data: TimelineData, now = Date.now()): void {
  const key = keyFor(username);
  const entry: CacheEntry = { data, expiresAt: now + CACHE_TTL_MS };
  memoryCache.set(key, entry);

  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota exceeded: the in-memory cache still saves quota for this session.
  }
}

export function clearTimelineCache(): void {
  memoryCache.clear();
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) storage.removeItem(key);
    }
  } catch {
    // Nothing else to clean up if storage is inaccessible.
  }
}
