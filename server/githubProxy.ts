import {
  GITHUB_API_URL,
  GitHubApiError,
  PER_PAGE,
  hasNextPage,
  isAbortError,
  parseRepo,
  parseUser,
  reposPageUrl,
  toApiError,
} from '../src/api/github';
import type { GitHubRepo, GitHubUser, TimelineData } from '../src/types/github';

const MAX_PAGES = 100;

function buildHeaders(githubToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'github-timeline-server/1.0.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = githubToken?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function getGitHubJson(
  url: string,
  githubToken?: string,
  signal?: AbortSignal,
): Promise<{ body: unknown; headers: Headers }> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      headers: buildHeaders(githubToken),
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new GitHubApiError('network', 'Network request to GitHub failed', { cause: error });
  }

  if (!response.ok) throw toApiError(response);

  try {
    return { body: (await response.json()) as unknown, headers: response.headers };
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new GitHubApiError('unknown', 'Malformed JSON from GitHub', { cause: error });
  }
}

export async function fetchGitHubUserFromServer(
  username: string,
  githubToken?: string,
  signal?: AbortSignal,
): Promise<GitHubUser> {
  const url = `${GITHUB_API_URL}/users/${encodeURIComponent(username)}`;
  const { body } = await getGitHubJson(url, githubToken, signal);
  const user = parseUser(body);
  if (!user) throw new GitHubApiError('unknown', 'Unexpected user shape from GitHub');
  return user;
}

export async function fetchAllGitHubReposFromServer(
  username: string,
  githubToken?: string,
  signal?: AbortSignal,
): Promise<GitHubRepo[]> {
  const all: GitHubRepo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = reposPageUrl(username, page);
    const { body, headers } = await getGitHubJson(url, githubToken, signal);
    if (!Array.isArray(body)) {
      throw new GitHubApiError('unknown', 'Unexpected repos response shape from GitHub');
    }

    const items: unknown[] = body;
    for (const item of items) {
      const repo = parseRepo(item);
      if (!repo) throw new GitHubApiError('unknown', 'Unexpected repo item shape from GitHub');
      all.push(repo);
    }

    if (items.length < PER_PAGE) break;
    const link = headers.get('link');
    if (link !== null && !hasNextPage(link)) break;
  }

  return all;
}

/**
 * Fetches a user's profile and all public repositories from GitHub on the server,
 * optionally authenticating with `GITHUB_TOKEN` (raising the limit from 60 to 5,000 req/hr).
 */
export async function fetchTimelineFromGitHubServer(
  username: string,
  githubToken?: string,
  signal?: AbortSignal,
): Promise<TimelineData> {
  const user = await fetchGitHubUserFromServer(username, githubToken, signal);
  const repos = await fetchAllGitHubReposFromServer(user.login, githubToken, signal);
  return { user, repos: repos.filter((repo) => !repo.private) };
}

