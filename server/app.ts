import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import { GitHubApiError } from '../src/api/github';
import { validateUsername } from '../src/utils/validateUsername';
import { DEFAULT_DB_CACHE_TTL_MS, type TimelineStore } from './db';
import { fetchTimelineFromGitHubServer } from './githubProxy';

export interface ServerAppOptions {
  store: TimelineStore;
  githubToken?: string;
  cacheTtlMs?: number;
  staticDir?: string;
}

function statusForErrorKind(kind: GitHubApiError['kind']): number {
  switch (kind) {
    case 'not_found':
      return 404;
    case 'rate_limited':
      return 429;
    case 'network':
    case 'server':
      return 502;
    case 'unknown':
      return 500;
  }
}

export function createApp({
  store,
  githubToken = process.env.GITHUB_TOKEN,
  cacheTtlMs = DEFAULT_DB_CACHE_TTL_MS,
  staticDir,
}: ServerAppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const stats = await store.getStats();
      res.json({
        status: 'ok',
        database: store.driver,
        githubTokenConfigured: Boolean(githubToken?.trim()),
        ...stats,
      });
    } catch {
      res.status(500).json({ status: 'error', database: store.driver });
    }
  });

  app.get('/api/timeline/:username', async (req: Request, res: Response) => {
    const rawUsername = String(req.params.username ?? '');
    const validation = validateUsername(rawUsername);
    if (!validation.ok) {
      res.status(400).json({
        error: {
          kind: 'invalid_username',
          message: validation.message,
        },
      });
      return;
    }

    const { username } = validation;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const now = Date.now();

    let cached: Awaited<ReturnType<TimelineStore['get']>> = null;
    try {
      cached = await store.get(username);
    } catch (error) {
      console.error('[Server] Database read failed, falling back to live GitHub fetch:', error);
    }

    if (cached && !forceRefresh && cached.expiresAt > now) {
      void store.touchLookup(username).catch(() => undefined);
      res.setHeader('X-Timeline-Cache', 'HIT');
      res.json({
        user: cached.data.user,
        repos: cached.data.repos,
        meta: {
          source: 'database-cache',
          fetchedAt: new Date(cached.fetchedAt).toISOString(),
          expiresAt: new Date(cached.expiresAt).toISOString(),
          lookupCount: cached.lookupCount + 1,
        },
      });
      return;
    }

    try {
      const freshData = await fetchTimelineFromGitHubServer(username, githubToken);
      let savedRecord = {
        fetchedAt: now,
        expiresAt: now + cacheTtlMs,
        lookupCount: (cached?.lookupCount ?? 0) + 1,
      };
      try {
        savedRecord = await store.save(username, freshData, now, cacheTtlMs);
      } catch (error) {
        console.error('[Server] Database write failed:', error);
      }

      res.setHeader('X-Timeline-Cache', 'MISS');
      res.json({
        user: freshData.user,
        repos: freshData.repos,
        meta: {
          source: 'github-live',
          fetchedAt: new Date(savedRecord.fetchedAt).toISOString(),
          expiresAt: new Date(savedRecord.expiresAt).toISOString(),
          lookupCount: savedRecord.lookupCount,
        },
      });
    } catch (error) {
      // If GitHub rate-limits or errors out and we have a stale snapshot in the DB, serve it!
      if (
        cached &&
        error instanceof GitHubApiError &&
        (error.kind === 'rate_limited' || error.kind === 'server' || error.kind === 'network')
      ) {
        res.setHeader('X-Timeline-Cache', 'STALE');
        res.json({
          user: cached.data.user,
          repos: cached.data.repos,
          meta: {
            source: 'database-stale',
            fetchedAt: new Date(cached.fetchedAt).toISOString(),
            expiresAt: new Date(cached.expiresAt).toISOString(),
            lookupCount: cached.lookupCount,
          },
        });
        return;
      }

      if (error instanceof GitHubApiError) {
        if (error.resetAt) {
          res.setHeader('x-ratelimit-remaining', '0');
          res.setHeader('x-ratelimit-reset', String(Math.floor(error.resetAt.getTime() / 1000)));
        }
        res.status(statusForErrorKind(error.kind)).json({
          error: {
            kind: error.kind,
            message: error.message,
            resetAt: error.resetAt ? error.resetAt.toISOString() : undefined,
          },
        });
        return;
      }

      console.error('[Server] Unexpected error handling /api/timeline:', error);
      res.status(500).json({
        error: {
          kind: 'unknown',
          message: 'Unexpected server error',
        },
      });
    }
  });

  // In production, serve the built Vite SPA from ./dist
  const resolvedStaticDir = staticDir ?? path.resolve('dist');
  const indexHtml = path.join(resolvedStaticDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(resolvedStaticDir));
    app.use((req: Request, res: Response, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  return app;
}
