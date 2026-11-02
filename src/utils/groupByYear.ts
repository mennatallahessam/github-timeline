import type { GitHubRepo } from '../types/github';
import { getYear } from './formatDate';

export interface YearGroup {
  year: number;
  repos: GitHubRepo[];
}

export interface YearCount {
  year: number;
  count: number;
}

export type TimelineSide = 'left' | 'right';

export type TimelineEntry =
  | { kind: 'year'; key: string; year: number }
  | { kind: 'repo'; key: string; repo: GitHubRepo; side: TimelineSide };

/** Groups consecutive repos sharing a creation year, preserving the input order. */
export function groupByYear(repos: readonly GitHubRepo[]): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const repo of repos) {
    const year = getYear(repo.created_at);
    const last = groups[groups.length - 1];
    if (last && last.year === year) {
      last.repos.push(repo);
    } else {
      groups.push({ year, repos: [repo] });
    }
  }
  return groups;
}

/** Repo counts per creation year, ascending by year (chart order). */
export function countByYear(repos: readonly GitHubRepo[]): YearCount[] {
  const counts = new Map<number, number>();
  for (const repo of repos) {
    const year = getYear(repo.created_at);
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Flattens repos into the render list for the timeline: a year marker is
 * inserted whenever the year changes, and cards alternate sides. Alternation
 * counts only repo cards so markers never cause two cards on the same side.
 */
export function buildTimelineEntries(repos: readonly GitHubRepo[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let cardIndex = 0;
  for (const group of groupByYear(repos)) {
    entries.push({ kind: 'year', key: `year-${group.year}-${entries.length}`, year: group.year });
    for (const repo of group.repos) {
      entries.push({
        kind: 'repo',
        key: `repo-${repo.id}`,
        repo,
        side: cardIndex % 2 === 0 ? 'left' : 'right',
      });
      cardIndex++;
    }
  }
  return entries;
}

/** DOM id for a year marker, shared by the timeline and the year summary. */
export function yearAnchorId(year: number): string {
  return `year-${year}`;
}
