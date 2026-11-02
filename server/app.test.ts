// @vitest-environment node
import { EventEmitter } from 'node:events';
import type { Express, Request, Response as ExpressResponse } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { jsonResponse, makeRepo, makeUser } from '../src/test/fixtures';
import { createApp } from './app';
import { SqliteTimelineStore } from './db';

type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;
let fetchMock: FetchMock;
let store: SqliteTimelineStore;

interface TestResponse {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * Dispatches an HTTP GET request through the Express app in-memory without
 * opening a TCP socket, so tests run fast in any environment.
 */
async function getFromApp(app: Express, urlPath: string): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const req = Object.assign(new EventEmitter(), {
      method: 'GET',
      url: urlPath,
      originalUrl: urlPath,
      path: urlPath.split('?')[0],
      headers: { accept: 'application/json' },
      socket: { remoteAddress: '127.0.0.1' },
      connection: { remoteAddress: '127.0.0.1' },
    }) as unknown as Request;

    const headers: Record<string, string> = {};
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      locals: {},
      setHeader(name: string, value: string | number | readonly string[]) {
        headers[name.toLowerCase()] = String(value);
        return this;
      },
      getHeader(name: string) {
        return headers[name.toLowerCase()];
      },
      removeHeader(name: string) {
        Reflect.deleteProperty(headers, name.toLowerCase());
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        headers['content-type'] = 'application/json';
        resolve({
          status: this.statusCode,
          headers,
          body: (payload ?? {}) as Record<string, unknown>,
        });
        return this;
      },
      end(chunk?: unknown) {
        resolve({
          status: this.statusCode,
          headers,
          body:
            typeof chunk === 'string' && chunk
              ? (JSON.parse(chunk) as Record<string, unknown>)
              : {},
        });
        return this;
      },
    }) as unknown as ExpressResponse;

    app(req, res, (err?: unknown) => {
      if (err) reject(err instanceof Error ? err : new Error(String(err)));
      else resolve({ status: 404, headers, body: {} });
    });
  });
}

beforeEach(async () => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  store = new SqliteTimelineStore(':memory:');
  await store.init();
});

afterEach(async () => {
  await store.close();
  vi.unstubAllGlobals();
});

describe('Backend server & SQLite database cache', () => {
  it('reports health status and database stats at GET /api/health', async () => {
    const app = createApp({ store, githubToken: 'ghp_test_token' });
    const res = await getFromApp(app, '/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      database: 'sqlite',
      githubTokenConfigured: true,
      cachedProfiles: 0,
      totalLookups: 0,
    });
  });

  it('rejects malformed usernames with 400 before hitting GitHub', async () => {
    const app = createApp({ store });
    const res = await getFromApp(app, '/api/timeline/bad--name');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ kind: 'invalid_username' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches from GitHub on cache miss, stores in DB, and serves from DB on subsequent hit', async () => {
    const user = makeUser({ login: 'torvalds' });
    const repos = [makeRepo({ id: 1, name: 'linux' })];
    fetchMock.mockResolvedValueOnce(jsonResponse(user)).mockResolvedValueOnce(jsonResponse(repos));

    const app = createApp({ store, githubToken: 'ghp_secret' });

    // 1. Cache MISS -> fetches from GitHub with Authorization header and stores in SQLite
    const missRes = await getFromApp(app, '/api/timeline/torvalds');
    expect(missRes.status).toBe(200);
    expect(missRes.headers['x-timeline-cache']).toBe('MISS');
    expect(missRes.body.user).toEqual(user);
    expect(missRes.body.repos).toEqual(repos);
    expect(missRes.body.meta).toMatchObject({
      source: 'github-live',
      lookupCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer ghp_secret',
    });

    // 2. Cache HIT -> served directly from SQLite without calling GitHub
    const hitRes = await getFromApp(app, '/api/timeline/TORVALDS');
    expect(hitRes.status).toBe(200);
    expect(hitRes.headers['x-timeline-cache']).toBe('HIT');
    expect(hitRes.body.meta).toMatchObject({
      source: 'database-cache',
      lookupCount: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // 3. Health reflects cached profile and lookup count
    const healthRes = await getFromApp(app, '/api/health');
    expect(healthRes.body.cachedProfiles).toBe(1);
    expect(healthRes.body.totalLookups).toBe(2);
  });

  it('serves a stale database snapshot if GitHub rate-limits after TTL expiry', async () => {
    const user = makeUser({ login: 'octocat' });
    const repos = [makeRepo({ id: 7, name: 'hello-world' })];
    // Pre-populate an already-expired entry
    await store.save('octocat', { user, repos }, 1000, 500);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: 'API rate limit exceeded' },
        {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' },
        },
      ),
    );

    const app = createApp({ store });
    const res = await getFromApp(app, '/api/timeline/octocat');

    expect(res.status).toBe(200);
    expect(res.headers['x-timeline-cache']).toBe('STALE');
    expect(res.body.meta).toMatchObject({ source: 'database-stale' });
    expect(res.body.user).toEqual(user);
  });

  it('returns 404 when GitHub reports user not found', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, { status: 404 }));
    const app = createApp({ store });
    const res = await getFromApp(app, '/api/timeline/ghost-user');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ kind: 'not_found' });
  });
});
