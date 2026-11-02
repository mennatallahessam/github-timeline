import type { GitHubRepo } from '../types/github';

export type SortOrder = 'newest' | 'oldest';

export interface RepoFilters {
  sort: SortOrder;
  includeForks: boolean;
  includeArchived: boolean;
  language: string | null;
}

export const DEFAULT_FILTERS: RepoFilters = {
  sort: 'newest',
  includeForks: false,
  includeArchived: true,
  language: null,
};

export interface LanguageStat {
  language: string;
  count: number;
  percentage: number;
}

export function filterRepos(
  repos: readonly GitHubRepo[],
  {
    includeForks,
    includeArchived,
    language = null,
  }: Pick<RepoFilters, 'includeForks' | 'includeArchived'> & { language?: string | null },
): GitHubRepo[] {
  return repos.filter(
    (repo) =>
      !repo.private &&
      (includeForks || !repo.fork) &&
      (includeArchived || !repo.archived) &&
      (language === null || repo.language === language),
  );
}

/**
 * Counts repositories per primary language (sorted by count descending, then
 * alphabetically). Callers pass the fork/archive-filtered list so the bar stays
 * visible and lets the user switch between languages freely.
 */
export function countByLanguage(repos: readonly GitHubRepo[]): LanguageStat[] {
  const counts = new Map<string, number>();
  let totalWithLanguage = 0;

  for (const repo of repos) {
    if (!repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
    totalWithLanguage++;
  }

  if (totalWithLanguage === 0) return [];

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([language, count]) => ({
      language,
      count,
      percentage: Math.round((count / totalWithLanguage) * 1000) / 10,
    }));
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
