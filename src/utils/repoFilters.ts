import type { GitHubRepo } from '../types/github';

export type SortOrder = 'newest' | 'oldest';

export interface RepoFilters {
  sort: SortOrder;
  includeForks: boolean;
  includeArchived: boolean;
}

export const DEFAULT_FILTERS: RepoFilters = {
  sort: 'newest',
  includeForks: false,
  includeArchived: true,
};

export function filterRepos(
  repos: readonly GitHubRepo[],
  { includeForks, includeArchived }: Pick<RepoFilters, 'includeForks' | 'includeArchived'>,
): GitHubRepo[] {
  return repos.filter(
    (repo) => !repo.private && (includeForks || !repo.fork) && (includeArchived || !repo.archived),
  );
}

/** Returns a new array sorted by creation date; ties fall back to name for stable output. */
export function sortRepos(repos: readonly GitHubRepo[], order: SortOrder): GitHubRepo[] {
  const direction = order === 'newest' ? -1 : 1;
  return [...repos].sort((a, b) => {
    const diff = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (diff !== 0) return diff * direction;
    return a.name.localeCompare(b.name);
  });
}

export function applyFilters(repos: readonly GitHubRepo[], filters: RepoFilters): GitHubRepo[] {
  return sortRepos(filterRepos(repos, filters), filters.sort);
}

