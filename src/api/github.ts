import type { FetchErrorKind, GitHubRepo, GitHubUser, TimelineData } from '../types/github';

export const GITHUB_API_URL = 'https://api.github.com';
export const PER_PAGE = 100;
/** Hard stop so a misbehaving API can never trap us in an infinite pagination loop. */
const MAX_PAGES = 100;

let backendProxyEnabled = true;

/** Allows enabling or disabling the `/api/timeline/:username` backend proxy (e.g. in unit tests). */
export function setBackendProxyEnabled(enabled: boolean): void {
  backendProxyEnabled = enabled;
}

export class GitHubApiError extends Error {
  readonly kind: FetchErrorKind;
  readonly status?: number;
  readonly resetAt?: Date;

  constructor(
    kind: FetchErrorKind,
    message: string,
    options: { status?: number; resetAt?: Date; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'GitHubApiError';
    this.kind = kind;
    this.status = options.status;
    this.resetAt = options.resetAt;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

/* ------------------------------------------------------------------ */
/* Runtime validation: the API is an external boundary, so never trust */
/* its shape. Parsers also strip unused fields to keep the cache small. */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

export function parseUser(value: unknown): GitHubUser | null {
  if (!isRecord(value)) return null;
  const { login, name, avatar_url, bio, html_url, public_repos, created_at } = value;
  if (
    typeof login !== 'string' ||
    typeof avatar_url !== 'string' ||
    typeof html_url !== 'string' ||
    typeof public_repos !== 'number' ||
    typeof created_at !== 'string'
  ) {
    return null;
  }
  return {
    login,
    name: asNullableString(name),
    avatar_url,
    bio: asNullableString(bio),
    html_url,
    public_repos,
    created_at,
  };
}

export function parseRepo(value: unknown): GitHubRepo | null {
  if (!isRecord(value)) return null;
  const { id, name, html_url, created_at, stargazers_count, fork } = value;
  if (
    typeof id !== 'number' ||
    typeof name !== 'string' ||
    typeof html_url !== 'string' ||
    typeof created_at !== 'string' ||
    Number.isNaN(Date.parse(created_at)) ||
    typeof fork !== 'boolean'
  ) {
    return null;
  }
  return {
    id,
    name,
    html_url,
    description: asNullableString(value.description),
    created_at,
    language: asNullableString(value.language),
    stargazers_count: typeof stargazers_count === 'number' ? stargazers_count : 0,
    fork,
    archived: value.archived === true,
    homepage: asNullableString(value.homepage),
    // Unknown visibility is treated as private so it is never shown by accident.
    private: value.private !== false,
  };
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

export function hasNextPage(linkHeader: string | null): boolean {
  return linkHeader !== null && /rel="next"/.test(linkHeader);
}

function parseResetAt(headers: Headers): Date | undefined {
  const reset = headers.get('x-ratelimit-reset');
  if (reset !== null && reset.trim() !== '') {
    const seconds = Number(reset);
    if (Number.isFinite(seconds)) return new Date(seconds * 1000);
  }
  const retryAfter = headers.get('retry-after');
  if (retryAfter !== null && retryAfter.trim() !== '') {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return new Date(Date.now() + seconds * 1000);
  }
  return undefined;
}

/** Translates a non-2xx response into a typed error. */
export function toApiError(response: Response): GitHubApiError {
  const { status, headers } = response;
  if (status === 404) {
    return new GitHubApiError('not_found', 'GitHub user not found', { status });
  }
  // 403 is only a rate limit when the quota header says so; 429 is always one.
  const quotaExhausted = headers.get('x-ratelimit-remaining') === '0';
  if (status === 429 || (status === 403 && quotaExhausted)) {
    return new GitHubApiError('rate_limited', 'GitHub API rate limit exceeded', {
      status,
      resetAt: parseResetAt(headers),
    });
  }
  if (status >= 500) {
    return new GitHubApiError('server', `GitHub responded with ${status}`, { status });
  }
  return new GitHubApiError('unknown', `Unexpected GitHub response ${status}`, { status });
}

async function getJson(
  url: string,
  signal?: AbortSignal,
): Promise<{ body: unknown; headers: Headers }> {
  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' } });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
    throw new GitHubApiError('network', 'Network request to GitHub failed', { cause: error });
  }

  if (!response.ok) throw toApiError(response);

  try {
    return { body: (await response.json()) as unknown, headers: response.headers };
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
    console.error('[GitHub Timeline] Could not parse JSON from', url, error);
    throw new GitHubApiError('unknown', 'Malformed JSON from GitHub', { cause: error });
  }
}

function malformed(url: string, body: unknown): GitHubApiError {
  console.error('[GitHub Timeline] Unexpected response shape from', url, body);
  return new GitHubApiError('unknown', 'Unexpected response shape from GitHub');
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function fetchUser(username: string, signal?: AbortSignal): Promise<GitHubUser> {
  const url = `${GITHUB_API_URL}/users/${encodeURIComponent(username)}`;
  const { body } = await getJson(url, signal);
  const user = parseUser(body);
  if (!user) throw malformed(url, body);
  return user;
}

export function reposPageUrl(username: string, page: number): string {
  const params = new URLSearchParams({
    per_page: String(PER_PAGE),
    type: 'owner',
    sort: 'created',
    direction: 'desc',
    page: String(page),
  });
  return `${GITHUB_API_URL}/users/${encodeURIComponent(username)}/repos?${params.toString()}`;
}

/** Fetches every page of a user's repositories (users can own thousands). */
export async function fetchAllRepos(username: string, signal?: AbortSignal): Promise<GitHubRepo[]> {
  const all: GitHubRepo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = reposPageUrl(username, page);
    const { body, headers } = await getJson(url, signal);
    if (!Array.isArray(body)) throw malformed(url, body);

    const items: unknown[] = body;
    for (const item of items) {
      const repo = parseRepo(item);
      if (!repo) throw malformed(url, item);
      all.push(repo);
    }

    if (items.length < PER_PAGE) break;
    // When GitHub sends a Link header it is authoritative about further pages.
    const link = headers.get('link');
    if (link !== null && !hasNextPage(link)) break;
  }

  return all;
}

/**
 * Attempts to load the timeline from our backend database/proxy (`/api/timeline/:username`)
 * first. If the backend returns valid timeline data or a structured API error, we use it.
 * If the backend is unreachable or returns a non-JSON SPA fallback (e.g. static-only hosting
 * or direct unit tests), seamlessly falls back to direct GitHub REST API calls.
 */
async function tryFetchFromBackend(
  username: string,
  signal?: AbortSignal,
): Promise<TimelineData | null> {
  if (!backendProxyEnabled || typeof window === 'undefined') return null;

  let response: Response;
  try {
    response = await fetch(`/api/timeline/${encodeURIComponent(username)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (isAbortError(error)) throw error;
    return null;
  }

  if (!isRecord(body)) return null;

  if (!response.ok) {
    if (isRecord(body.error) && typeof body.error.kind === 'string') {
      const kind = body.error.kind as FetchErrorKind;
      const resetAt =
        typeof body.error.resetAt === 'string' && !Number.isNaN(Date.parse(body.error.resetAt))
          ? new Date(body.error.resetAt)
          : undefined;
      if (
        kind === 'not_found' ||
        kind === 'rate_limited' ||
        kind === 'network' ||
        kind === 'server' ||
        kind === 'unknown'
      ) {
        throw new GitHubApiError(kind, String(body.error.message ?? 'Backend API error'), {
          status: response.status,
          resetAt,
        });
      }
    }
    return null;
  }

  if (!('user' in body) || !('repos' in body) || !Array.isArray(body.repos)) {
    return null;
  }

  const user = parseUser(body.user);
  if (!user) return null;

  const parsedRepos: GitHubRepo[] = [];
  for (const item of body.repos) {
    const repo = parseRepo(item);
    if (!repo) return null;
    if (!repo.private) parsedRepos.push(repo);
  }

  return { user, repos: parsedRepos };
}

/** Verifies the user exists, then loads all of their public repositories (via backend cache/proxy or direct GitHub API). */
export async function fetchTimeline(username: string, signal?: AbortSignal): Promise<TimelineData> {
  const fromBackend = await tryFetchFromBackend(username, signal);
  if (fromBackend) return fromBackend;

  const user = await fetchUser(username, signal);
  const repos = await fetchAllRepos(user.login, signal);
  return { user, repos: repos.filter((repo) => !repo.private) };
}
