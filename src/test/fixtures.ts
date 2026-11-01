import type { GitHubRepo, GitHubUser } from '../types/github';

let nextId = 1;

export function makeUser(overrides: Partial<GitHubUser> = {}): GitHubUser {
  return {
    login: 'octocat',
    name: 'The Octocat',
    avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    bio: 'Mascot of GitHub.',
    html_url: 'https://github.com/octocat',
    public_repos: 3,
    created_at: '2011-01-25T18:44:36Z',
    ...overrides,
  };
}

export function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  const id = overrides.id ?? nextId++;
  return {
    id,
    name: `repo-${id}`,
    html_url: `https://github.com/octocat/repo-${id}`,
    description: `Description for repo ${id}`,
    created_at: '2020-06-15T12:00:00Z',
    language: 'TypeScript',
    stargazers_count: 0,
    fork: false,
    archived: false,
    homepage: null,
    private: false,
    ...overrides,
  };
}

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

/** Builds `count` repos with sequential ids and descending creation dates. */
export function makeRepos(count: number, startYear = 2024): GitHubRepo[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(startYear, 11, 28) - index * 86_400_000);
    return makeRepo({ id: 10_000 + index, created_at: date.toISOString() });
  });
}

